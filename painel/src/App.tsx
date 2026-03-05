import { useState, useEffect } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import { api, type Config, type ContaInstagramRes, type ContaInstagramInput, type Postagem } from "./api/client";
import { Postador } from "./pages/Postador";

function PageAdmin() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [editId, setEditId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState({ nome: "", ig_user_id: "", access_token: "" });

  useEffect(() => {
    api
      .getConfig()
      .then((data) => {
        setConfig(data);
        setNome(data.empresa?.nome ?? "");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao carregar"))
      .finally(() => setLoading(false));
  }, []);

  const contas = config?.contas_instagram ?? [];
  const defaultId = config?.instagram_default_id ?? null;

  const handleSaveEmpresa = () => {
    setSaving(true);
    setError(null);
    api
      .putConfig({ empresa: { nome } })
      .then((res) => setConfig((c) => (c ? { ...c, empresa: res.received?.empresa ?? c.empresa } : null)))
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao salvar"))
      .finally(() => setSaving(false));
  };

  const handleSetDefault = (id: string) => {
    setSaving(true);
    setError(null);
    api
      .putConfig({ instagram_default_id: id })
      .then((res) => setConfig((c) => (c ? { ...c, instagram_default_id: res.received?.instagram_default_id ?? id } : null)))
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao salvar"))
      .finally(() => setSaving(false));
  };

  const handleSaveConta = () => {
    if (!form.nome.trim() || !form.ig_user_id.trim()) {
      setError("Nome e ID do usuário são obrigatórios.");
      return;
    }
    setSaving(true);
    setError(null);
    const list: ContaInstagramInput[] =
      editId === "new"
        ? [...contas.map((c) => ({ id: c.id, nome: c.nome, ig_user_id: c.ig_user_id })), { nome: form.nome.trim(), ig_user_id: form.ig_user_id.trim(), access_token: form.access_token.trim() || undefined }]
        : contas.map((c) =>
            c.id === editId
              ? { id: c.id, nome: form.nome.trim(), ig_user_id: form.ig_user_id.trim(), access_token: form.access_token.trim() || undefined }
              : { id: c.id, nome: c.nome, ig_user_id: c.ig_user_id }
          );
    api
      .putConfig({ contas_instagram: list })
      .then((res) => {
        setConfig((c) => (c ? { ...c, contas_instagram: res.received?.contas_instagram ?? c.contas_instagram } : null));
        setEditId(null);
        setForm({ nome: "", ig_user_id: "", access_token: "" });
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao salvar"))
      .finally(() => setSaving(false));
  };

  const handleRemoveConta = (id: string) => {
    if (!confirm("Remover esta conta? O token será perdido.")) return;
    const list = contas.filter((c) => c.id !== id).map((c) => ({ id: c.id, nome: c.nome, ig_user_id: c.ig_user_id }));
    setSaving(true);
    setError(null);
    api
      .putConfig({
        contas_instagram: list,
        instagram_default_id: defaultId === id ? (list[0]?.id ?? null) : defaultId,
      })
      .then((res) => setConfig((c) => (c ? { ...c, contas_instagram: res.received?.contas_instagram ?? [], instagram_default_id: res.received?.instagram_default_id ?? null } : null)))
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao remover"))
      .finally(() => setSaving(false));
  };

  const startEdit = (conta: ContaInstagramRes) => {
    setEditId(conta.id);
    setForm({ nome: conta.nome, ig_user_id: conta.ig_user_id, access_token: "" });
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
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-semibold">Administração</h1>
      <p className="text-gray-600 mt-2 mb-6">Dados da empresa e contas Instagram para postar (várias contas).</p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nome da empresa</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Ex.: Minha Empresa"
            />
            <button type="button" onClick={handleSaveEmpresa} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
              Salvar
            </button>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-medium text-gray-900 mb-2">Contas Instagram para postar</h2>
          <p className="text-sm text-gray-500 mb-3">Adicione várias contas e escolha qual usar ao publicar no Postador.</p>

          <ul className="space-y-2 mb-4">
            {contas.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <span className="font-medium text-gray-800">{c.nome || "Sem nome"}</span>
                <span className="text-sm text-gray-500">({c.ig_user_id})</span>
                {c.has_token && <span className="text-xs text-green-600">Token ok</span>}
                {defaultId === c.id && <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">Padrão</span>}
                <div className="ml-auto flex gap-2">
                  {defaultId !== c.id && (
                    <button type="button" onClick={() => handleSetDefault(c.id)} disabled={saving} className="text-sm text-blue-600 hover:underline">
                      Definir padrão
                    </button>
                  )}
                  <button type="button" onClick={() => startEdit(c)} disabled={saving} className="text-sm text-gray-600 hover:underline">
                    Editar
                  </button>
                  <button type="button" onClick={() => handleRemoveConta(c.id)} disabled={saving} className="text-sm text-red-600 hover:underline">
                    Excluir
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {(editId === "new" || editId) && (
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
              <h3 className="font-medium text-gray-800">{editId === "new" ? "Nova conta" : "Editar conta"}</h3>
              <input
                type="text"
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder="Nome (ex.: Conta principal)"
              />
              <input
                type="text"
                value={form.ig_user_id}
                onChange={(e) => setForm((f) => ({ ...f, ig_user_id: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
                placeholder="ID do usuário Instagram (ig_user_id)"
              />
              <input
                type="password"
                value={form.access_token}
                onChange={(e) => setForm((f) => ({ ...f, access_token: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
                placeholder={editId === "new" ? "Token de acesso (obrigatório)" : "Token (deixe em branco para manter o atual)"}
              />
              <div className="flex gap-2">
                <button type="button" onClick={handleSaveConta} disabled={saving || !form.nome.trim() || !form.ig_user_id.trim() || (editId === "new" && !form.access_token.trim())} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
                  {saving ? "Salvando..." : editId === "new" ? "Adicionar conta" : "Salvar alterações"}
                </button>
                <button type="button" onClick={() => { setEditId(null); setForm({ nome: "", ig_user_id: "", access_token: "" }); }} className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50">
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {!editId && (
            <button type="button" onClick={() => { setEditId("new"); setForm({ nome: "", ig_user_id: "", access_token: "" }); }} className="px-4 py-2 border border-blue-600 text-blue-600 rounded-md hover:bg-blue-50 text-sm font-medium">
              + Adicionar conta Instagram
            </button>
          )}
        </div>
      </div>
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
