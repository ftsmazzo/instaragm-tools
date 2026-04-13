import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  api,
  getAuthToken,
  clearAuthToken,
  type Config,
  type ContaInstagramRes,
  type ContaInstagramInput,
  type EmpresaPerfilRes,
} from "../api/client";

function emptyEmpresa(): EmpresaPerfilRes {
  return {
    nome: "",
    nome_fantasia: "",
    segmento: "",
    cidade: "",
    tom_voz: "",
    sobre: "",
    objetivo_qualificacao: "",
  };
}

function mergeEmpresa(e?: Partial<EmpresaPerfilRes>): EmpresaPerfilRes {
  return { ...emptyEmpresa(), ...e };
}

const PROMPT_COMENTARIOS_PADRAO = `Você responde comentários no Instagram em nome da empresa. Seja cordial, objetivo e profissional. Não prometa o que não pode cumprir. Para valores, visitas ou negociação, convide a pessoa a enviar mensagem direta.`;

const PROMPT_DIRECT_PADRAO = `Você atende mensagens diretas no Instagram em nome da empresa. Ajude com informações e tire dúvidas com claro bom senso. Peça dados só quando necessário. Se não souber algo, diga que um consultor vai retornar em breve.`;

function emptyContaForm() {
  return {
    nome: "",
    ig_user_id: "",
    access_token: "",
    agent_access_token: "",
    agent_ativo: false,
    agent_nome: "",
    agent_prompt_comentarios: "",
    agent_prompt_direct: "",
  };
}

export function AdminPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [empresa, setEmpresa] = useState<EmpresaPerfilRes>(emptyEmpresa);
  const [editId, setEditId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState(emptyContaForm);
  /** Dados vêm de /api/me/workspace (organização + contas no PostgreSQL). */
  const [useWorkspace, setUseWorkspace] = useState(false);
  const [needLogin, setNeedLogin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const status = await api.getAuthStatus();
        if (cancelled) return;
        if (status.authMode === "workspace" && status.hasUsers) {
          const token = getAuthToken();
          if (!token) {
            setNeedLogin(true);
            setUseWorkspace(true);
            setConfig(null);
            return;
          }
          try {
            const data = await api.getMeWorkspace();
            if (cancelled) return;
            setConfig(data);
            setEmpresa(mergeEmpresa(data.empresa));
            setUseWorkspace(true);
            setNeedLogin(false);
          } catch {
            clearAuthToken();
            setNeedLogin(true);
            setConfig(null);
            setUseWorkspace(true);
          }
        } else {
          const data = await api.getConfig();
          if (cancelled) return;
          setConfig(data);
          setEmpresa(mergeEmpresa(data.empresa));
          setUseWorkspace(false);
          setNeedLogin(false);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erro ao carregar");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const contas = config?.contas_instagram ?? [];
  const defaultId = config?.instagram_default_id ?? null;

  const handleSaveEmpresa = () => {
    setSaving(true);
    setError(null);
    const p =
      useWorkspace && getAuthToken()
        ? api.putMeWorkspace({ empresa })
        : api.putConfig({ empresa });
    p.then((res) =>
      setConfig((c) => (c ? { ...c, empresa: res.received?.empresa ?? c.empresa } : null))
    )
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao salvar"))
      .finally(() => setSaving(false));
  };

  const handleSetDefault = (id: string) => {
    setSaving(true);
    setError(null);
    const p =
      useWorkspace && getAuthToken()
        ? api.putMeWorkspace({ instagram_default_id: id })
        : api.putConfig({ instagram_default_id: id });
    p.then((res) =>
      setConfig((c) => (c ? { ...c, instagram_default_id: res.received?.instagram_default_id ?? id } : null))
    )
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
        ? [
            ...contas.map((c) => ({ id: c.id, nome: c.nome, ig_user_id: c.ig_user_id })),
            {
              nome: form.nome.trim(),
              ig_user_id: form.ig_user_id.trim(),
              access_token: form.access_token.trim() || undefined,
              agent_access_token: form.agent_access_token.trim() || undefined,
              agent_ativo: form.agent_ativo,
              agent_nome: form.agent_nome.trim(),
              agent_prompt_comentarios: form.agent_prompt_comentarios,
              agent_prompt_direct: form.agent_prompt_direct,
            },
          ]
        : contas.map((c) =>
            c.id === editId
              ? {
                  id: c.id,
                  nome: form.nome.trim(),
                  ig_user_id: form.ig_user_id.trim(),
                  access_token: form.access_token.trim() || undefined,
                  agent_access_token: form.agent_access_token.trim() || undefined,
                  agent_ativo: form.agent_ativo,
                  agent_nome: form.agent_nome.trim(),
                  agent_prompt_comentarios: form.agent_prompt_comentarios,
                  agent_prompt_direct: form.agent_prompt_direct,
                }
              : { id: c.id, nome: c.nome, ig_user_id: c.ig_user_id }
          );
    const p =
      useWorkspace && getAuthToken()
        ? api.putMeWorkspace({ contas_instagram: list })
        : api.putConfig({ contas_instagram: list });
    p.then((res) => {
      setConfig((c) => (c ? { ...c, contas_instagram: res.received?.contas_instagram ?? c.contas_instagram } : null));
      setEditId(null);
      setForm(emptyContaForm());
    })
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao salvar"))
      .finally(() => setSaving(false));
  };

  const handleRemoveConta = (id: string) => {
    if (!confirm("Remover esta conta? O token será perdido.")) return;
    const list = contas.filter((c) => c.id !== id).map((c) => ({ id: c.id, nome: c.nome, ig_user_id: c.ig_user_id }));
    setSaving(true);
    setError(null);
    const body = {
      contas_instagram: list,
      instagram_default_id: defaultId === id ? (list[0]?.id ?? null) : defaultId,
    };
    const p = useWorkspace && getAuthToken() ? api.putMeWorkspace(body) : api.putConfig(body);
    p.then((res) =>
      setConfig((c) =>
        c ? { ...c, contas_instagram: res.received?.contas_instagram ?? [], instagram_default_id: res.received?.instagram_default_id ?? null } : null
      )
    )
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao remover"))
      .finally(() => setSaving(false));
  };

  const startEdit = (conta: ContaInstagramRes) => {
    setEditId(conta.id);
    setForm({
      nome: conta.nome,
      ig_user_id: conta.ig_user_id,
      access_token: "",
      agent_access_token: "",
      agent_ativo: conta.agent_ativo ?? false,
      agent_nome: conta.agent_nome ?? "",
      agent_prompt_comentarios: conta.agent_prompt_comentarios ?? "",
      agent_prompt_direct: conta.agent_prompt_direct ?? "",
    });
  };

  const aplicarGerarAgente = () => {
    const nomeAssistente = (form.agent_nome.trim() || form.nome.trim() || empresa.nome.trim() || "Assistente").slice(0, 120);
    setForm((f) => ({
      ...f,
      agent_ativo: true,
      agent_nome: nomeAssistente,
      agent_prompt_comentarios: f.agent_prompt_comentarios.trim() ? f.agent_prompt_comentarios : PROMPT_COMENTARIOS_PADRAO,
      agent_prompt_direct: f.agent_prompt_direct.trim() ? f.agent_prompt_direct : PROMPT_DIRECT_PADRAO,
    }));
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
      <p className="text-gray-600 mt-2 mb-6">
        {useWorkspace
          ? "Workspace da sua organização: empresa e contas Instagram usadas no Postador e integrações."
          : "Dados da empresa e contas Instagram para postar (modo legado, sem login)."}
      </p>

      {needLogin && (
        <div className="mb-4 p-4 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-900 text-sm">
          <p className="font-medium">Login necessário</p>
          <p className="mt-1 text-indigo-800/90">As contas Instagram estão vinculadas ao seu usuário e organização.</p>
          <Link to="/login" className="mt-3 inline-block text-indigo-700 font-semibold hover:underline">
            Ir para login
          </Link>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm">{error}</div>
      )}

      {!needLogin && (
      <div className="space-y-6">
        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
          <h2 className="text-lg font-medium text-gray-900">Dados da empresa</h2>
          <p className="text-sm text-gray-500">
            Esses campos alimentam a API (<code className="text-xs bg-gray-100 px-1 rounded">empresa_perfil</code> no{" "}
            <code className="text-xs bg-gray-100 px-1 rounded">agent-config</code>) para montar contexto no n8n sem repetir tudo nos prompts.
          </p>
          <label className="block text-sm font-medium text-gray-700">Nome (razão social / registro)</label>
          <input
            type="text"
            value={empresa.nome}
            onChange={(e) => setEmpresa((x) => ({ ...x, nome: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            placeholder="Ex.: Fabrica IA"
          />
          <label className="block text-sm font-medium text-gray-700">Nome fantasia / marca</label>
          <input
            type="text"
            value={empresa.nome_fantasia}
            onChange={(e) => setEmpresa((x) => ({ ...x, nome_fantasia: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            placeholder="Como a marca aparece para o público"
          />
          <label className="block text-sm font-medium text-gray-700">Segmento</label>
          <input
            type="text"
            value={empresa.segmento}
            onChange={(e) => setEmpresa((x) => ({ ...x, segmento: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            placeholder="Ex.: imobiliária, clínica, e-commerce"
          />
          <label className="block text-sm font-medium text-gray-700">Cidade / região de atuação</label>
          <input
            type="text"
            value={empresa.cidade}
            onChange={(e) => setEmpresa((x) => ({ ...x, cidade: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
          <label className="block text-sm font-medium text-gray-700">Tom de voz (curto)</label>
          <input
            type="text"
            value={empresa.tom_voz}
            onChange={(e) => setEmpresa((x) => ({ ...x, tom_voz: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            placeholder="Ex.: cordial e direto; sem jargão excessivo"
          />
          <label className="block text-sm font-medium text-gray-700">Sobre a empresa</label>
          <textarea
            value={empresa.sobre}
            onChange={(e) => setEmpresa((x) => ({ ...x, sobre: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[80px]"
            placeholder="1–3 frases: o que faz, para quem, diferencial."
          />
          <label className="block text-sm font-medium text-gray-700">Objetivo de qualificação (multi-segmento)</label>
          <textarea
            value={empresa.objetivo_qualificacao}
            onChange={(e) => setEmpresa((x) => ({ ...x, objetivo_qualificacao: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[72px]"
            placeholder="O que o agente deve descobrir no lead (ex.: interesse em compra, agendar visita, orçamento)."
          />
          <button
            type="button"
            onClick={handleSaveEmpresa}
            disabled={saving}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium"
          >
            Salvar dados da empresa
          </button>
        </div>

        <div>
          <h2 className="text-lg font-medium text-gray-900 mb-2">Contas Instagram para postar</h2>
          <p className="text-sm text-gray-500 mb-3">Adicione várias contas e escolha qual usar ao publicar no Postador.</p>

          <ul className="space-y-2 mb-4">
            {contas.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <span className="font-medium text-gray-800">{c.nome || "Sem nome"}</span>
                <span className="text-sm text-gray-500">({c.ig_user_id})</span>
                {c.has_token && <span className="text-xs text-green-600">Token postagem</span>}
                {c.has_agent_token && <span className="text-xs text-teal-700">Token agente</span>}
                {c.agent_ativo && <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">Agente ativo</span>}
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
                placeholder={editId === "new" ? "Token de publicação Graph API (obrigatório)" : "Token postagem (vazio = manter)"}
              />
              <p className="text-xs text-gray-500 font-medium pt-1">Agente Instagram (Direct / comentários)</p>
              <div className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                <p className="font-semibold">Importante — painel ≠ n8n automaticamente</p>
                <p className="mt-1 leading-relaxed">
                  Salvar tokens e prompts aqui grava na <strong>API / banco</strong>. O workflow do n8n <strong>não muda sozinho</strong> e{" "}
                  <strong>não lê esta tela</strong>. Para o Instagram usar estes prompts, o fluxo precisa, no início, chamar{" "}
                  <code className="rounded bg-amber-100/80 px-1">GET /api/internal/agent-config?ig_user_id=…</code> (header{" "}
                  <code className="rounded bg-amber-100/80 px-1">X-Internal-Secret</code>) e injetar{" "}
                  <code className="rounded bg-amber-100/80 px-1">agent_prompt_comentarios</code> e{" "}
                  <code className="rounded bg-amber-100/80 px-1">agent_prompt_direct</code> nos agentes. Sem isso, o n8n segue com texto fixo no fluxo.
                </p>
              </div>
              <p className="text-xs text-gray-500 mb-1">
                Token separado do de publicação. Use o token com permissões de mensagens conforme o app Meta. Variável na API:{" "}
                <code className="bg-gray-200 px-1 rounded">INTERNAL_AGENT_API_SECRET</code> (mesmo valor do header no n8n).
              </p>
              <input
                type="password"
                value={form.agent_access_token}
                onChange={(e) => setForm((f) => ({ ...f, agent_access_token: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
                placeholder={editId === "new" ? "Token do agente (opcional)" : "Token agente (vazio = manter)"}
              />
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.agent_ativo}
                  onChange={(e) => setForm((f) => ({ ...f, agent_ativo: e.target.checked }))}
                />
                Agente ativo (automação pode usar esta conta)
              </label>
              <input
                type="text"
                value={form.agent_nome}
                onChange={(e) => setForm((f) => ({ ...f, agent_nome: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder="Nome do assistente (ex.: Equipe ImobMiq)"
              />
              <textarea
                value={form.agent_prompt_comentarios}
                onChange={(e) => setForm((f) => ({ ...f, agent_prompt_comentarios: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[88px]"
                placeholder="Prompt para respostas em comentários"
              />
              <textarea
                value={form.agent_prompt_direct}
                onChange={(e) => setForm((f) => ({ ...f, agent_prompt_direct: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[88px]"
                placeholder="Prompt para mensagens diretas"
              />
              <button
                type="button"
                onClick={aplicarGerarAgente}
                className="w-full px-3 py-2 border border-emerald-600 text-emerald-700 rounded-md text-sm font-medium hover:bg-emerald-50"
              >
                Gerar perfil de agente (prompts padrão + ativar)
              </button>
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
                    setForm(emptyContaForm());
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
                setForm(emptyContaForm());
              }}
              className="px-4 py-2 border border-indigo-600 text-indigo-600 rounded-md hover:bg-indigo-50 text-sm font-medium"
            >
              + Adicionar conta Instagram
            </button>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
