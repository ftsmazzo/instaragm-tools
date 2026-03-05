import { parse } from "node-html-parser";
import { uploadMedia, isStorageConfigured } from "./storage.js";

// Dentro do EasyPanel a API não resolve o host público do site. Use URL interna para o fetch.
const SITE_IMOVEIS_PUBLIC_HOST = (process.env.SITE_IMOVEIS_PUBLIC_HOST ?? "").trim().toLowerCase();
const SITE_IMOVEIS_INTERNAL_ORIGIN = (process.env.SITE_IMOVEIS_INTERNAL_ORIGIN ?? "").trim();

function urlParaFetch(userUrl: string): string {
  if (!SITE_IMOVEIS_PUBLIC_HOST || !SITE_IMOVEIS_INTERNAL_ORIGIN) return userUrl;
  try {
    const u = new URL(userUrl);
    if (u.hostname.toLowerCase() === SITE_IMOVEIS_PUBLIC_HOST) {
      const internal = SITE_IMOVEIS_INTERNAL_ORIGIN.replace(/\/$/, "");
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
  imageUrl: string | null;
};

function resolveUrl(base: string, path: string): string {
  if (path.startsWith("http")) return path;
  const u = new URL(base);
  if (path.startsWith("//")) return u.protocol + path;
  if (path.startsWith("/")) return u.origin + path;
  return base.replace(/\/[^/]*$/, "/") + path;
}

/**
 * Baixa o HTML da página e extrai dados do imóvel + URL da imagem principal.
 * Tenta primeiro __NEXT_DATA__ (Next.js), depois meta/og e parsing HTML.
 */
export async function rasparPaginaImovel(url: string): Promise<ImovelDados> {
  const fetchUrl = urlParaFetch(url);
  const res = await fetch(fetchUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; PostadorImovel/1.0)" },
  });
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
        let imageUrl: string | null = null;
        const img = imovel.imagem ?? imovel.foto ?? imovel.image ?? imovel.images;
        if (typeof img === "string") imageUrl = img.startsWith("http") ? img : new URL(img, baseUrl).href;
        else if (Array.isArray(img) && img[0]) imageUrl = String(img[0]).startsWith("http") ? String(img[0]) : new URL(String(img[0]), baseUrl).href;
        if (imageUrl) imageUrl = urlParaFetch(imageUrl);
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

  const imageUrl =
    getMeta("og:image") ||
    root.querySelector("img[src*='imoveis'], img[src*='upload'], .gallery img, [data-imagem]")?.getAttribute("src") ||
    root.querySelector("img")?.getAttribute("src") ||
    null;
  let absoluteImageUrl: string | null = imageUrl ? resolveUrl(url, imageUrl) : null;
  if (absoluteImageUrl) absoluteImageUrl = urlParaFetch(absoluteImageUrl);

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
