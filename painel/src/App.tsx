import { useState, useEffect } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import { api, type Config, type Postagem } from "./api/client";
import { Postador } from "./pages/Postador";

function PageAdmin() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [instagramToken, setInstagramToken] = useState("");
  const [instagramIgUserId, setInstagramIgUserId] = useState("");

  useEffect(() => {
    api
      .getConfig()
      .then((data) => {
        setConfig(data);
        setNome(data.empresa.nome ?? "");
        setInstagramIgUserId(data.instagram?.ig_user_id ?? "");
        // Token não é retornado pelo GET (segurança); manter campo vazio ou não alterar estado
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao carregar"))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = () => {
    setSaving(true);
    setError(null);
    const instagramPayload: { access_token?: string; ig_user_id?: string } = {};
    if (instagramIgUserId.trim()) instagramPayload.ig_user_id = instagramIgUserId.trim();
    if (instagramToken.trim()) instagramPayload.access_token = instagramToken.trim();
    api
      .putConfig({
        empresa: { nome },
        instagram: { connected: Boolean(instagramToken.trim() && instagramIgUserId.trim()), ...instagramPayload },
      })
      .then((res) => setConfig({ empresa: { nome }, instagram: res.received?.instagram ?? { connected: false } }))
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao salvar"))
      .finally(() => setSaving(false));
  };

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold">Administração</h1>
        <p className="text-gray-600 mt-2">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Administração</h1>
      <p className="text-gray-600 mt-2 mb-6">Tokens Instagram, dados da empresa, configurações gerais.</p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm">
          {error}
        </div>
      )}

      <div className="max-w-md space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nome da empresa</label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Ex.: Minha Empresa"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Instagram — Token de acesso</label>
          <input
            type="password"
            value={instagramToken}
            onChange={(e) => setInstagramToken(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
            placeholder="Token de longa duração (Graph API)"
          />
          <p className="mt-1 text-xs text-gray-500">Usado para publicar posts pelo Postador. Não é exibido após salvar.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Instagram — ID do usuário (ig_user_id)</label>
          <input
            type="text"
            value={instagramIgUserId}
            onChange={(e) => setInstagramIgUserId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Ex.: 17841400008460056"
          />
          <p className="mt-1 text-xs text-gray-500">ID numérico da conta profissional Instagram vinculada à página.</p>
        </div>
        {config?.instagram?.connected && (
          <p className="text-sm text-green-600">Instagram configurado para publicar.</p>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </div>

      {config && (
        <p className="mt-4 text-gray-500 text-sm">Última config carregada da API.</p>
      )}
    </div>
  );
}

function formatarData(s?: string | null) {
  if (!s) return "—";
  try {
    const d = new Date(s);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return s;
  }
}

function PagePostagens() {
  const [postagens, setPostagens] = useState<Postagem[]>([]);
  const [loading, setLoading] = useState(true);
  const [raspando, setRaspando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const carregar = () => {
    setError(null);
    api
      .getPostagens()
      .then((r) => setPostagens(Array.isArray(r.postagens) ? (r.postagens as Postagem[]) : []))
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao carregar"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    carregar();
  }, []);

  const handleRaspar = () => {
    setRaspando(true);
    setError(null);
    api
      .rasparPostagens()
      .then((r) => {
        setPostagens(Array.isArray(r.postagens) ? (r.postagens as Postagem[]) : []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao raspar"))
      .finally(() => setRaspando(false));
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Postagens</h1>
      <p className="text-gray-600 mt-2 mb-4">Visualização das postagens raspadas e botão para disparar a raspagem.</p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleRaspar}
        disabled={raspando}
        className="mb-6 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
      >
        {raspando ? "Raspando..." : "Raspar postagens"}
      </button>

      {loading ? (
        <p className="text-gray-500">Carregando...</p>
      ) : postagens.length === 0 ? (
        <p className="text-gray-500">Nenhuma postagem. Clique em &quot;Raspar postagens&quot; para disparar a raspagem no n8n.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr className="bg-gray-50">
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Mídia
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Legenda
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden sm:table-cell">
                  Data
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden md:table-cell">
                  Tipo
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden lg:table-cell">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Link
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {postagens.map((p, i) => (
                <tr key={p.id ?? i} className="hover:bg-gray-50/80 transition-colors">
                  <td className="px-4 py-3">
                    {p.media_url ? (
                      <a
                        href={p.link_post ?? "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-14 h-14 rounded-lg overflow-hidden border border-gray-200 bg-gray-100 shrink-0"
                      >
                        <img
                          src={p.media_url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </a>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 max-w-[280px] sm:max-w-[320px]">
                    <p className="text-sm text-gray-800 line-clamp-3" title={p.caption_post ?? undefined}>
                      {p.caption_post || "—"}
                    </p>
                    {p.hashtags && (
                      <p className="text-xs text-gray-500 mt-1 truncate" title={p.hashtags}>
                        {p.hashtags}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell whitespace-nowrap">
                    {formatarData(p.data_post)}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-xs font-medium text-gray-600">{p.media_type ?? "—"}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        p.processado ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {p.processado ? "Processado" : "Pendente"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {p.link_post ? (
                      <a
                        href={p.link_post}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center rounded-md bg-gray-100 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
                      >
                        Abrir
                      </a>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PageAgentes() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Agentes e leads</h1>
      <p className="text-gray-600 mt-2">Configuração e visualização dos agentes, leads e conversas.</p>
    </div>
  );
}

function PagePerfil() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Perfil</h1>
      <p className="text-gray-600 mt-2">Dados do usuário, alteração de senha e login.</p>
    </div>
  );
}

function PageWhatsApp() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Conexão WhatsApp</h1>
      <p className="text-gray-600 mt-2">Instância e conexão de WhatsApp.</p>
    </div>
  );
}

const nav = [
  { path: "/", label: "Início" },
  { path: "/admin", label: "Administração" },
  { path: "/postagens", label: "Postagens" },
  { path: "/agentes", label: "Agentes e leads" },
  { path: "/postador", label: "Postador" },
  { path: "/perfil", label: "Perfil" },
  { path: "/whatsapp", label: "WhatsApp" },
];

function Layout({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="w-56 bg-white border-r border-gray-200 p-4">
        <div className="font-semibold text-gray-800 mb-6">FabriaIA</div>
        <nav className="space-y-1">
          {nav.map(({ path, label }) => (
            <Link
              key={path}
              to={path}
              className={`block px-3 py-2 rounded-md text-sm ${
                loc.pathname === path ? "bg-gray-100 text-gray-900" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1">{children}</main>
    </div>
  );
}

function Home() {
  const [apiStatus, setApiStatus] = useState<"checking" | "ok" | "error">("checking");

  useEffect(() => {
    api
      .getHealth()
      .then(() => setApiStatus("ok"))
      .catch(() => setApiStatus("error"));
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Painel FabriaIA</h1>
      <p className="text-gray-600 mt-2 mb-4">Use o menu para acessar Administração, Postagens, Agentes, Postador, Perfil e WhatsApp.</p>
      <p className="text-sm">
        API:{" "}
        {apiStatus === "checking" && <span className="text-gray-500">verificando...</span>}
        {apiStatus === "ok" && <span className="text-green-600 font-medium">conectada</span>}
        {apiStatus === "error" && <span className="text-red-600">indisponível</span>}
      </p>
    </div>
  );
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/admin" element={<PageAdmin />} />
        <Route path="/postagens" element={<PagePostagens />} />
        <Route path="/agentes" element={<PageAgentes />} />
        <Route path="/postador" element={<Postador />} />
        <Route path="/perfil" element={<PagePerfil />} />
        <Route path="/whatsapp" element={<PageWhatsApp />} />
      </Routes>
    </Layout>
  );
}
