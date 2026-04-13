import { parse } from "node-html-parser";
import { uploadMedia, isStorageConfigured } from "./storage.js";

// Dentro do EasyPanel a API não resolve o host público do site (EAI_AGAIN). O fetch usa a origem interna.
const SITE_IMOVEIS_PUBLIC_HOST_RAW = (process.env.SITE_IMOVEIS_PUBLIC_HOST ?? "").trim();
const SITE_IMOVEIS_INTERNAL_ORIGIN = (process.env.SITE_IMOVEIS_INTERNAL_ORIGIN ?? "").trim();

function publicHostsList(): string[] {
  return SITE_IMOVEIS_PUBLIC_HOST_RAW.split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Converte URL pública do site de imóveis em URL acessível de dentro do Docker (serviço interno).
 * - Com SITE_IMOVEIS_PUBLIC_HOST: um ou vários hosts separados por vírgula.
 * - Sem PUBLIC_HOST mas com SITE_IMOVEIS_INTERNAL_ORIGIN: heurística só para URLs típicas do EasyPanel
 *   (hostname contém "site-imoveis" e termina em .easypanel.host), para não depender de copiar o host exato.
 */
export function urlParaFetchImovel(userUrl: string): string {
  const internal = SITE_IMOVEIS_INTERNAL_ORIGIN.replace(/\/$/, "");
  if (!internal) return userUrl;
  try {
    const u = new URL(userUrl);
    const host = u.hostname.toLowerCase();
    const listed = publicHostsList();
    const explicit = listed.length > 0 && listed.includes(host);
    const heuristic =
      listed.length === 0 && host.includes("site-imoveis") && host.endsWith(".easypanel.host");
    if (explicit || heuristic) {
      return `${internal}${u.pathname}${u.search}`;
    }
  } catch {
    // ignore
  }
  return userUrl;
}

export type ImovelDados = {
  titulo: string;
  codigo: string;
  localizacao: string;
  venda: string;
  iptu: string;
  condominio: string;
  resumo: string[];
  caracteristicas: string[];
  descricao: string;
  /** Primeira imagem (retrocompat). */
  imageUrl: string | null;
  /** Até 10 URLs para carrossel no Instagram (mesma ordem da galeria do site). */
  imageUrls: string[];
};

function resolveUrl(base: string, path: string): string {
  if (path.startsWith("http")) return path;
  const u = new URL(base);
  if (path.startsWith("//")) return u.protocol + path;
  if (path.startsWith("/")) return u.origin + path;
  return base.replace(/\/[^/]*$/, "/") + path;
}

const MAX_IMAGENS_IMOVEL = 10;

/** Extrai URLs de imagem do objeto imóvel (Next.js pageProps). */
function coletarImagensNext(imovel: Record<string, unknown>, pageBaseUrl: string): string[] {
  const fields: unknown[] = [
    imovel.imagens,
    imovel.fotos,
    imovel.galeria,
    imovel.images,
    imovel.fotosUrls,
    imovel.imagem,
    imovel.foto,
    imovel.image,
  ];
  const out: string[] = [];
  const seen = new Set<string>();
  const addAbs = (raw: string) => {
    const s = raw.trim();
    if (!s || s.startsWith("data:")) return;
    const abs = s.startsWith("http") ? s : resolveUrl(pageBaseUrl, s);
    const internal = urlParaFetchImovel(abs);
    if (seen.has(internal)) return;
    seen.add(internal);
    out.push(internal);
  };
  for (const field of fields) {
    if (field == null) continue;
    if (Array.isArray(field)) {
      for (const item of field) {
        if (typeof item === "string") addAbs(item);
        else if (item && typeof item === "object") {
          const o = item as Record<string, unknown>;
          const u = o.url ?? o.src ?? o.path ?? o.uri;
          if (typeof u === "string") addAbs(u);
        }
      }
    } else if (typeof field === "string") {
      addAbs(field);
    }
  }
  return out.slice(0, MAX_IMAGENS_IMOVEL);
}

function coletarImagensHtml(root: ReturnType<typeof parse>, pageUrl: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (src: string | null | undefined) => {
    if (!src?.trim() || src.startsWith("data:")) return;
    if (/logo|icon|avatar|favicon|sprite|placeholder/i.test(src)) return;
    if (!/\.(jpe?g|png|webp|gif)(\?|$)/i.test(src) && !/\/(upload|imoveis|storage|media|images)\b/i.test(src)) return;
    const abs = resolveUrl(pageUrl, src.trim());
    const internal = urlParaFetchImovel(abs);
    if (seen.has(internal)) return;
    seen.add(internal);
    out.push(internal);
  };
  root.querySelectorAll("img[src]").forEach((img) => add(img.getAttribute("src")));
  return out.slice(0, MAX_IMAGENS_IMOVEL);
}

/**
 * Baixa o HTML da página e extrai dados do imóvel + URL da imagem principal.
 * Tenta primeiro __NEXT_DATA__ (Next.js), depois meta/og e parsing HTML.
 */
export async function rasparPaginaImovel(url: string): Promise<ImovelDados> {
  const fetchUrl = urlParaFetchImovel(url);
  let res: Response;
  try {
    res = await fetch(fetchUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PostadorImovel/1.0)" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const dns = msg.includes("EAI_AGAIN") || msg.includes("getaddrinfo");
    if (dns && fetchUrl === url && !SITE_IMOVEIS_INTERNAL_ORIGIN) {
      throw new Error(
        "A API não conseguiu resolver o site do imóvel (DNS). No EasyPanel defina SITE_IMOVEIS_INTERNAL_ORIGIN com a URL interna do app (ex.: http://nome-do-servico:3000) e, opcionalmente, SITE_IMOVEIS_PUBLIC_HOST com o host público."
      );
    }
    if (dns && fetchUrl === url) {
      throw new Error(
        "A API não resolve o host público. Confira SITE_IMOVEIS_INTERNAL_ORIGIN e se o link do imóvel é do site esperado (ou defina SITE_IMOVEIS_PUBLIC_HOST=host.exato)."
      );
    }
    throw e;
  }
  if (!res.ok) throw new Error(`Não foi possível acessar a página: ${res.status}`);
  const html = await res.text();
  const baseUrl = url.replace(/\/[^/]*$/, "/");

  // Next.js: dados em script#__NEXT_DATA__
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (nextDataMatch) {
    try {
      const nextData = JSON.parse(nextDataMatch[1]) as { props?: { pageProps?: Record<string, unknown> } };
      const pageProps = nextData?.props?.pageProps;
      if (pageProps && typeof pageProps === "object") {
        const imovel = (pageProps.imovel ?? pageProps.imovelData ?? pageProps) as Record<string, unknown>;
        const titulo = String(imovel.titulo ?? imovel.nome ?? imovel.title ?? "");
        const codigo = String(imovel.codigo ?? imovel.referencia ?? "");
        const localizacao = String(imovel.localizacao ?? imovel.bairro ?? imovel.cidade ?? "");
        const valorVenda = imovel.valorVenda ?? imovel.preco ?? imovel.venda;
        const venda = valorVenda != null ? `Venda R$ ${Number(valorVenda).toLocaleString("pt-BR")}` : "";
        const iptu = imovel.iptu != null ? `IPTU R$ ${Number(imovel.iptu).toLocaleString("pt-BR")}` : "";
        const cond = imovel.condominio ?? imovel.condominioValor;
        const condominio = cond != null ? `Condomínio R$ ${Number(cond).toLocaleString("pt-BR")}` : "";
        const descricao = String(imovel.descricao ?? imovel.descricaoCompleta ?? "");
        const resumoArr = Array.isArray(imovel.resumo) ? imovel.resumo : Array.isArray(imovel.caracteristicas) ? imovel.caracteristicas : [];
        const resumo = resumoArr.map(String);
        const caracArr = Array.isArray(imovel.caracteristicas) ? imovel.caracteristicas : Array.isArray(imovel.extras) ? imovel.extras : [];
        const caracteristicas = caracArr.map(String);
        const imageUrls = coletarImagensNext(imovel, baseUrl);
        const imageUrl = imageUrls[0] ?? null;
        return {
          titulo,
          codigo,
          localizacao,
          venda,
          iptu,
          condominio,
          resumo,
          caracteristicas,
          descricao,
          imageUrl,
          imageUrls,
        };
      }
    } catch {
      // fallback para parsing HTML
    }
  }

  const root = parse(html);

  const getMeta = (name: string): string | null => {
    const el = root.querySelector(`meta[property="${name}"], meta[name="${name}"]`);
    return el?.getAttribute("content")?.trim() ?? null;
  };

  const getText = (sel: string): string =>
    root.querySelector(sel)?.textContent?.trim().replace(/\s+/g, " ").trim() ?? "";

  const ogImage =
    getMeta("og:image") ||
    root.querySelector("img[src*='imoveis'], img[src*='upload'], .gallery img, [data-imagem]")?.getAttribute("src") ||
    root.querySelector("img")?.getAttribute("src") ||
    null;
  let absoluteOg: string | null = ogImage ? resolveUrl(url, ogImage) : null;
  if (absoluteOg) absoluteOg = urlParaFetchImovel(absoluteOg);

  let imageUrls = coletarImagensHtml(root, url);
  if (absoluteOg && !imageUrls.includes(absoluteOg)) {
    imageUrls = [absoluteOg, ...imageUrls].slice(0, MAX_IMAGENS_IMOVEL);
  }
  if (imageUrls.length === 0 && absoluteOg) {
    imageUrls = [absoluteOg];
  }
  const absoluteImageUrl = imageUrls[0] ?? null;

  // Título: h1 ou og:title ou title
  const titulo =
    getText("h1") ||
    getMeta("og:title")?.replace(/\s*[-|].*$/, "").trim() ||
    root.querySelector("title")?.textContent?.trim()?.replace(/\s*[-|].*$/, "").trim() ||
    "";

  // Código: padrão "Cód. IMV-00003" ou similar
  const codigoMatch = html.match(/Cód\.\s*([^\s<]+)/i) || html.match(/codigo["']?\s*[:=]\s*["']?([^"'\s<]+)/i);
  const codigo = codigoMatch ? codigoMatch[1].trim() : "";

  // Localização: após "Localização" ou em meta
  const locSection = root.querySelector("h2, h3, .localizacao, [class*='local']");
  let localizacao = getMeta("og:locale") ?? "";
  if (!localizacao && locSection) {
    const next = locSection.nextElementSibling?.textContent?.trim();
    if (next) localizacao = next.replace(/\s+/g, " ").trim();
  }
  const locFromTitle = getMeta("og:title")?.match(/\s[-–]\s*(.+?)(?:\s*[-|]|$)/);
  if (locFromTitle) localizacao = locFromTitle[1].trim();

  // Valores: Venda, IPTU, Condomínio
  const vendaMatch = html.match(/Venda\s*R\$\s*[\d.,]+/i);
  const venda = vendaMatch ? vendaMatch[0].replace(/\s+/g, " ").trim() : "";
  const iptuMatch = html.match(/IPTU\s*R\$\s*[\d.,]+/i);
  const iptu = iptuMatch ? iptuMatch[0].replace(/\s+/g, " ").trim() : "";
  const condMatch = html.match(/Condomínio\s*R\$\s*[\d.,]+/i);
  const condominio = condMatch ? condMatch[0].replace(/\s+/g, " ").trim() : "";

  // Resumo: lista com quartos, área, etc.
  const resumoList: string[] = [];
  root.querySelectorAll("ul li, .resumo li, [class*='resumo'] li").forEach((el) => {
    const t = el.textContent?.trim();
    if (t && /quartos?|banheiros?|área|terreno|vaga|sala|lavabo|m²/i.test(t)) resumoList.push(t);
  });
  const resumo = resumoList.length ? resumoList : [];
  if (resumo.length === 0) {
    const resumoBlock = html.match(/Resumo[\s\S]*?<\/section>|Resumo[\s\S]*?<ul>([\s\S]*?)<\/ul>/i);
    if (resumoBlock) {
      const items = resumoBlock[0].match(/[\d,]+\s*m²|[\d]+\s*quartos?|[\d]+\s*banheiros?|[\d]+\s*vaga/g);
      if (items) resumo.push(...items);
    }
  }

  // Características
  const caracList: string[] = [];
  root.querySelectorAll(".caracteristicas li, [class*='caracteristica'] li, .chips span").forEach((el) => {
    const t = el.textContent?.trim();
    if (t && t.length < 50) caracList.push(t);
  });
  const caracteristicas = caracList.length ? caracList : [];

  // Descrição
  const descSection = root.querySelector("[class*='descricao'], .description, section");
  let descricao = "";
  if (descSection) {
    const h = descSection.querySelector("h2, h3");
    if (h?.textContent?.toLowerCase().includes("descri")) {
      descricao = descSection.textContent?.trim().replace(/\s+/g, " ").trim().slice(0, 500) ?? "";
    }
  }
  if (!descricao) descricao = getText("p") || "";

  return {
    titulo,
    codigo,
    localizacao,
    venda,
    iptu,
    condominio,
    resumo,
    caracteristicas,
    descricao,
    imageUrl: absoluteImageUrl,
    imageUrls,
  };
}

/**
 * Monta um texto único para a IA gerar a legenda do post a partir dos dados do imóvel.
 */
export function montarDescricaoParaCaption(d: ImovelDados): string {
  const parts: string[] = [];
  if (d.titulo) parts.push(`Título: ${d.titulo}`);
  if (d.codigo) parts.push(`Código: ${d.codigo}`);
  if (d.localizacao) parts.push(`Localização: ${d.localizacao}`);
  if (d.venda) parts.push(d.venda);
  if (d.iptu) parts.push(d.iptu);
  if (d.condominio) parts.push(d.condominio);
  if (d.resumo.length) parts.push(`Resumo: ${d.resumo.join(", ")}`);
  if (d.caracteristicas.length) parts.push(`Características: ${d.caracteristicas.join(", ")}`);
  if (d.descricao) parts.push(`Descrição: ${d.descricao}`);
  if (d.imageUrls.length > 1) {
    parts.push(`O anúncio tem ${d.imageUrls.length} fotos na galeria (carrossel).`);
  }
  return parts.join("\n");
}

/**
 * Baixa a imagem da URL e faz upload (Cloudinary, local ou MinIO). Retorna a URL pública.
 */
export async function baixarEEnviarParaCloudinary(imageUrl: string): Promise<{ url: string; contentType: string }> {
  if (!isStorageConfigured()) {
    throw new Error("Configure um armazenamento (Cloudinary, POSTADOR_STORAGE=local ou MinIO) para usar post por URL do imóvel.");
  }
  const res = await fetch(imageUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; PostadorImovel/1.0)" },
  });
  if (!res.ok) throw new Error(`Não foi possível baixar a imagem: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
  const ext = contentType === "image/png" ? ".png" : contentType === "image/webp" ? ".webp" : ".jpg";
  const url = await uploadMedia(buffer, contentType, ext);
  return { url, contentType };
}
