import { useState, useEffect } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import { api, type Config } from "./api/client";

// Primeira tela real: Administração (GET/PUT config)
function PageAdmin() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [instagramConnected, setInstagramConnected] = useState(false);

  useEffect(() => {
    api
      .getConfig()
      .then((data) => {
        setConfig(data);
        setNome(data.empresa.nome ?? "");
        setInstagramConnected(data.instagram?.connected ?? false);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao carregar"))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = () => {
    setSaving(true);
    setError(null);
    api
      .putConfig({
        empresa: { nome },
        instagram: { connected: instagramConnected },
      })
      .then(() => setConfig({ empresa: { nome }, instagram: { connected: instagramConnected } }))
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
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="instagram"
            checked={instagramConnected}
            onChange={(e) => setInstagramConnected(e.target.checked)}
            className="rounded border-gray-300"
          />
          <label htmlFor="instagram" className="text-sm text-gray-700">
            Instagram conectado
          </label>
        </div>
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
function PagePostagens() {
  const [postagens, setPostagens] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [raspando, setRaspando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const carregar = () => {
    setError(null);
    api
      .getPostagens()
      .then((r) => setPostagens(r.postagens ?? []))
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
        setPostagens(r.postagens ?? []);
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
        <ul className="space-y-4">
          {postagens.map((item, i) => (
            <li
              key={i}
              className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm"
            >
              {typeof item === "object" && item !== null ? (
                <pre className="text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap break-words">
                  {JSON.stringify(item, null, 2)}
                </pre>
              ) : (
                <span className="text-gray-700">{String(item)}</span>
              )}
            </li>
          ))}
        </ul>
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
function PagePostador() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Postador automático</h1>
      <p className="text-gray-600 mt-2">Formulário e estrutura do postador.</p>
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
        <Route path="/postador" element={<PagePostador />} />
        <Route path="/perfil" element={<PagePerfil />} />
        <Route path="/whatsapp" element={<PageWhatsApp />} />
      </Routes>
    </Layout>
  );
}
