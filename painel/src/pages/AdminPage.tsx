import { useState, useEffect } from "react";
import { api, type Config, type ContaInstagramRes, type ContaInstagramInput } from "../api/client";

export function AdminPage() {
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
      .then((res) =>
        setConfig((c) =>
          c ? { ...c, contas_instagram: res.received?.contas_instagram ?? [], instagram_default_id: res.received?.instagram_default_id ?? null } : null
        )
      )
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
        <h1 className="text-2xl font-semibold text-gray-900">Administração</h1>
        <p className="text-gray-600 mt-2">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-semibold text-gray-900">Administração</h1>
      <p className="text-gray-600 mt-2 mb-6">Dados da empresa e contas Instagram para postar (várias contas).</p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm">{error}</div>
      )}

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nome da empresa</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Ex.: Minha Empresa"
            />
            <button
              type="button"
              onClick={handleSaveEmpresa}
              disabled={saving}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium"
            >
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
                {defaultId === c.id && <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded">Padrão</span>}
                <div className="ml-auto flex gap-2">
                  {defaultId !== c.id && (
                    <button type="button" onClick={() => handleSetDefault(c.id)} disabled={saving} className="text-sm text-indigo-600 hover:underline">
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
                <button
                  type="button"
                  onClick={handleSaveConta}
                  disabled={saving || !form.nome.trim() || !form.ig_user_id.trim() || (editId === "new" && !form.access_token.trim())}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium"
                >
                  {saving ? "Salvando..." : editId === "new" ? "Adicionar conta" : "Salvar alterações"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditId(null);
                    setForm({ nome: "", ig_user_id: "", access_token: "" });
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {!editId && (
            <button
              type="button"
              onClick={() => {
                setEditId("new");
                setForm({ nome: "", ig_user_id: "", access_token: "" });
              }}
              className="px-4 py-2 border border-indigo-600 text-indigo-600 rounded-md hover:bg-indigo-50 text-sm font-medium"
            >
              + Adicionar conta Instagram
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
