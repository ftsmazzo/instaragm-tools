import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PageShell } from "../components/layout/PageShell";
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

/** Prompt de sistema para o agente de comentário + primeiro Direct (JSON). O fluxo deve injetar antes: CONTEXTO DA EMPRESA (API) + nome do assistente. */
const PROMPT_COMENTARIOS_PADRAO = `# IDENTIDADE
Você é o assistente virtual da empresa. Use o nome do assistente e a marca conforme o bloco **CONTEXTO DA EMPRESA** que o sistema envia junto a esta instrução (nome fantasia, segmento, cidade, tom de voz, sobre o negócio, objetivo de qualificação). Em comentários e Direct, seja breve, objetivo e humano — como uma pessoa real.

# SUA TAREFA
Gere **dois textos** no mesmo tom, como uma atendente respondendo o comentário e enviando o Direct ao mesmo tempo:

**1. resposta_comentario** — Resposta pública ao comentário.
- Breve (até ~150 caracteres), alinhada ao que a pessoa disse e ao conteúdo do post.
- Use o nome da pessoa quando estiver no contexto.
- Termine com **CTA claro** para olhar o Direct (ex.: convite para ver a mensagem privada).
- Não invente preços, produtos ou promessas que não estejam no post ou no CONTEXTO DA EMPRESA.

**2. resposta_direct** — Mensagem que a pessoa **já recebeu** no Direct (a resposta pública deve remeter a isso).
- Continuação natural do comentário: humanizada, curta.
- Objetivo: cumprimentar, criar conexão e convidar a continuar no Direct (nome, telefone, WhatsApp) quando couber — sem interrogatório.
- Até ~200 caracteres. Tom de conversa, não de folder.

Os dois textos devem parecer **uma única ação**: comentário + Direct coerentes entre si.

# CONTEXTO (fornecido pelo fluxo)
No **User message** vêm: quem comentou, texto do comentário, tipo de mídia, relação com o perfil (segue/não), legenda, data, descrição da mídia, hashtags. Use tudo para personalizar. Se não houver descrição de mídia (ex.: vídeo), use legenda + tipo de mídia.

# REGRAS
- Trate pelo nome quando disponível.
- Não copie o comentário literalmente; responda ao sentido.
- Sem respostas genéricas vazias; cada par deve ser único.
- Emojis com moderação.
- Respeite o segmento e o tom definidos no CONTEXTO DA EMPRESA.

# PROIBIÇÕES
- Citar preços, condições ou detalhes que não estejam autorizados no contexto.
- Soar robótico ou usar frases longas e artificiais.
- Desconectar comentário e Direct.

# SAÍDA
Retorne **somente** um JSON com exatamente estas chaves (sem markdown ao redor):
{"resposta_comentario":"...","resposta_direct":"..."}`;

/** Prompt de sistema para o agente de Direct (continuidade). Injeta CONTEXTO DA EMPRESA (API) + Message com histórico. Nomes de ferramentas alinhados ao n8n. */
const PROMPT_DIRECT_PADRAO = `# Quem você é
Você é o assistente virtual da empresa. Use o **nome do assistente**, o tom e os dados da marca conforme o bloco **CONTEXTO DA EMPRESA** (nome fantasia, segmento, cidade, tom de voz, sobre, objetivo de qualificação). Você atende no Direct de forma humana, cordial e direta — como uma pessoa real, não um script. Você já foi apresentado na primeira mensagem (Private Reply ou Direct inicial); **não se apresente de novo** como se fosse o primeiro contato.

# Contexto que você recebe
- **Rota com post:** No Message vêm o contexto do post em que a pessoa comentou, o comentário, dados do perfil (nome no IG, @, se segue/não), a primeira mensagem no Direct e a última mensagem dela. Use isso para responder no assunto: o que ela viu, o que disse, o que você já falou.
- **Rota sem post:** Você recebe só a última mensagem da pessoa e dados básicos do lead (id, @). Contato direto pelo Direct, sem comentário. Seja acolhedor e natural; **não invente** post nem comentário.

Em ambos os casos, quando o fluxo permitir: você pode **consultar** se já temos nome e WhatsApp desse lead e **cadastrar/atualizar** quando a pessoa informar; pode **enviar mensagem no WhatsApp** quando houver número válido e avisar no Direct que seguem por lá.

# Objetivo da conversa
- Responder ao que a pessoa disse de forma relevante e humana (conectada ao post quando houver).
- Qualificar o lead conforme **objetivo_qualificacao** e o segmento no CONTEXTO DA EMPRESA (multi-segmento: adapte perguntas ao negócio — não assuma um único nicho salvo quando o contexto indicar).
- Saber como chamar a pessoa (nome) e obter WhatsApp (11 dígitos com DDD no Brasil) quando fizer sentido — sem interrogatório; encaixe no fluxo natural.
- Cadastrar/atualizar o lead com os dados e, quando houver WhatsApp válido, usar a ferramenta de envio e avisar no Direct de forma natural (ex.: chamou no WhatsApp e seguem por lá).

# Como usar as ferramentas
1. **consulta_lead(id_instagram)** — No início da conversa (ou quando precisar), com o id do lead em contexto, para ver se já temos nome e WhatsApp. Isso evita pedir de novo o que já consta.
2. **cadastrar_lead(id_instagram, nome?, whatsapp?, objetivo?)** — Quando a pessoa informar nome, WhatsApp ou intenção alinhada à qualificação. Pode chamar mais de uma vez. Telefone: 11 dígitos (DDD + número); ao cadastrar, normalize com prefixo 55 quando o fluxo esperar.
3. **enviar_whatsapp(para, mensagem)** — Quando houver WhatsApp válido cadastrado. Mensagem curta, humana e alinhada ao segmento da empresa (use o CONTEXTO DA EMPRESA). No Direct, confirme que chamou no WhatsApp e que seguem por lá.

Não siga uma lista rígida: adapte à última mensagem. Se ela já mandou o nome, não peça de novo. Se já deu o WhatsApp, não repita. Se o contexto é um post específico, fale disso; se é Direct orgânico, não invente post.

# Tom e estilo
- Mensagens curtas (até ~300–400 caracteres no Direct), claras e pessoais.
- Use o nome quando souber; trate como quem já está em conversa.
- Evite frases genéricas de formulário (“receba todas as novidades…”) — prefira naturalidade.
- Perguntas de qualificação surgem do fluxo, não como checklist obrigatório.

# Proibições
- Não mencione produtos, preços, condições ou dados técnicos que não estejam autorizados no CONTEXTO DA EMPRESA ou no post.
- Não se reapresente.
- Não invente post, legenda ou comentário na rota sem post.
- Não cadastre telefone sem 11 dígitos válidos; se vier incompleto, peça uma vez de forma clara.
- Não envie WhatsApp antes de número válido e cadastro quando a ferramenta exigir.

# Saída
Responda em texto livre, em português, no tom do assistente definido no CONTEXTO DA EMPRESA. **Uma única mensagem** por resposta, direta para o Direct. Use as ferramentas quando precisar; **não descreva** as chamadas na resposta — apenas fale com a pessoa.`;

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
  const [searchParams, setSearchParams] = useSearchParams();
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
  /** API com META_APP_ID + SECRET + redirect (botão conectar). */
  const [metaOAuth, setMetaOAuth] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const status = await api.getAuthStatus();
        if (cancelled) return;
        setMetaOAuth(Boolean(status.metaOAuthConfigured));
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

  useEffect(() => {
    const mo = searchParams.get("meta_oauth");
    if (!mo) return;
    if (mo === "ok") {
      setError(null);
      const t = getAuthToken();
      if (t) {
        void api.getMeWorkspace().then((data) => {
          setConfig(data);
          setEmpresa(mergeEmpresa(data.empresa));
        });
      }
    } else if (mo === "err") {
      const r = searchParams.get("reason");
      setError(r ? decodeURIComponent(r.replace(/\+/g, " ")) : "Não foi possível conectar ao Facebook.");
    }
    const next = new URLSearchParams(searchParams);
    next.delete("meta_oauth");
    next.delete("reason");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

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

  /** Substitui os dois textareas pelos padrões atuais do código (não lê outro lugar — é o que está em PROMPT_* nesta versão do painel). */
  const handleConectarMeta = () => {
    setError(null);
    setSaving(true);
    api
      .getMetaOAuthUrl()
      .then((r) => {
        window.location.href = r.url;
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Não foi possível iniciar o login Meta."))
      .finally(() => setSaving(false));
  };

  const aplicarPromptsPadraoAtuais = () => {
    if (
      !confirm(
        "Substituir os dois prompts pelo padrão atual do sistema?\n\nIsso remove o texto antigo destes campos. Depois clique em Salvar alterações."
      )
    ) {
      return;
    }
    setForm((f) => ({
      ...f,
      agent_prompt_comentarios: PROMPT_COMENTARIOS_PADRAO,
      agent_prompt_direct: PROMPT_DIRECT_PADRAO,
    }));
  };

  if (loading) {
    return (
      <PageShell title="Administração" description="Carregando configuração…" wide>
        <div className="card h-36 animate-pulse bg-slate-100/80" aria-hidden />
      </PageShell>
    );
  }

  return (
    <PageShell
      wide
      title="Administração"
      description={
        useWorkspace
          ? "Workspace da sua organização: empresa e contas Instagram usadas no Postador e integrações."
          : "Dados da empresa e contas Instagram para postar (modo legado, sem login)."
      }
    >
      {needLogin && (
        <div className="alert-info mb-6">
          <p className="font-semibold">Login necessário</p>
          <p className="mt-1 opacity-90">As contas Instagram estão vinculadas ao seu usuário e organização.</p>
          <Link to="/login" className="btn-primary mt-4 inline-flex">
            Ir para login
          </Link>
        </div>
      )}

      {error && <div className="alert-error mb-6">{error}</div>}

      {!needLogin && (
      <div className="space-y-8">
        <div className="card space-y-4">
          <h2 className="font-display text-xl font-semibold text-slate-900">Dados da empresa</h2>
          <p className="text-sm text-slate-600">
            Esses campos alimentam a API (<code className="rounded bg-slate-100 px-1 text-xs">empresa_perfil</code> no{" "}
            <code className="rounded bg-slate-100 px-1 text-xs">agent-config</code>) para montar contexto no n8n sem repetir tudo nos prompts.
          </p>
          <label className="label-field">Nome (razão social / registro)</label>
          <input
            type="text"
            value={empresa.nome}
            onChange={(e) => setEmpresa((x) => ({ ...x, nome: e.target.value }))}
            className="input-field"
            placeholder="Ex.: Fabrica IA"
          />
          <label className="label-field">Nome fantasia / marca</label>
          <input
            type="text"
            value={empresa.nome_fantasia}
            onChange={(e) => setEmpresa((x) => ({ ...x, nome_fantasia: e.target.value }))}
            className="input-field"
            placeholder="Como a marca aparece para o público"
          />
          <label className="label-field">Segmento</label>
          <input
            type="text"
            value={empresa.segmento}
            onChange={(e) => setEmpresa((x) => ({ ...x, segmento: e.target.value }))}
            className="input-field"
            placeholder="Ex.: imobiliária, clínica, e-commerce"
          />
          <label className="label-field">Cidade / região de atuação</label>
          <input
            type="text"
            value={empresa.cidade}
            onChange={(e) => setEmpresa((x) => ({ ...x, cidade: e.target.value }))}
            className="input-field"
          />
          <label className="label-field">Tom de voz (curto)</label>
          <input
            type="text"
            value={empresa.tom_voz}
            onChange={(e) => setEmpresa((x) => ({ ...x, tom_voz: e.target.value }))}
            className="input-field"
            placeholder="Ex.: cordial e direto; sem jargão excessivo"
          />
          <label className="label-field">Sobre a empresa</label>
          <textarea
            value={empresa.sobre}
            onChange={(e) => setEmpresa((x) => ({ ...x, sobre: e.target.value }))}
            className="textarea-field min-h-[100px]"
            placeholder="1–3 frases: o que faz, para quem, diferencial."
          />
          <label className="label-field">Objetivo de qualificação (multi-segmento)</label>
          <textarea
            value={empresa.objetivo_qualificacao}
            onChange={(e) => setEmpresa((x) => ({ ...x, objetivo_qualificacao: e.target.value }))}
            className="textarea-field min-h-[88px]"
            placeholder="O que o agente deve descobrir no lead (ex.: interesse em compra, agendar visita, orçamento)."
          />
          <button type="button" onClick={handleSaveEmpresa} disabled={saving} className="btn-primary">
            Salvar dados da empresa
          </button>
        </div>

        <div>
          <h2 className="font-display text-xl font-semibold text-slate-900">Contas Instagram para postar</h2>
          <p className="mt-2 text-sm text-slate-600">Adicione várias contas e escolha qual usar ao publicar no Postador.</p>

          {useWorkspace && metaOAuth && (
            <div className="card mt-4 space-y-3 border-indigo-200/80 bg-indigo-50/40">
              <div>
                <h3 className="font-semibold text-slate-900">Conectar com Facebook / Instagram</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Abre o login da Meta: escolha a <strong>página</strong> que tem o Instagram comercial vinculado. Os tokens de
                  postagem e de agente serão preenchidos automaticamente (o mesmo token de página, com as permissões do app).
                </p>
              </div>
              <button type="button" onClick={handleConectarMeta} disabled={saving} className="btn-primary">
                {saving ? "Redirecionando…" : "Conectar conta Meta"}
              </button>
              <p className="text-xs text-slate-500">
                Na API: <code className="rounded bg-white/80 px-1">META_OAUTH_REDIRECT_URI</code> igual ao callback (ex.:{" "}
                <code className="rounded bg-white/80 px-1">…/api/auth/meta/callback</code>),{" "}
                <code className="rounded bg-white/80 px-1">PAINEL_PUBLIC_URL</code>. Se você usou o login da empresa no produto
                Instagram (URL <code className="rounded bg-white/80 px-1">instagram.com/oauth/authorize</code>), defina também{" "}
                <code className="rounded bg-white/80 px-1">META_OAUTH_MODE=instagram</code>.
              </p>
            </div>
          )}

          <ul className="mb-6 mt-4 space-y-3">
            {contas.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200/90 bg-slate-50/80 p-4 shadow-sm"
              >
                <span className="font-semibold text-slate-800">{c.nome || "Sem nome"}</span>
                <span className="text-sm text-slate-500">({c.ig_user_id})</span>
                {c.has_token && <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">Token postagem</span>}
                {c.has_agent_token && (
                  <span className="rounded-md bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-800">Token agente</span>
                )}
                {c.agent_ativo && (
                  <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">Agente ativo</span>
                )}
                {defaultId === c.id && (
                  <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800">Padrão</span>
                )}
                <div className="ml-auto flex flex-wrap gap-2">
                  {defaultId !== c.id && (
                    <button type="button" onClick={() => handleSetDefault(c.id)} disabled={saving} className="btn-ghost text-indigo-600 hover:text-indigo-700">
                      Definir padrão
                    </button>
                  )}
                  <button type="button" onClick={() => startEdit(c)} disabled={saving} className="btn-ghost">
                    Editar
                  </button>
                  <button type="button" onClick={() => handleRemoveConta(c.id)} disabled={saving} className="btn-ghost text-red-600 hover:text-red-700">
                    Excluir
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {(editId === "new" || editId) && (
            <div className="card space-y-4 bg-slate-50/50">
              <h3 className="font-display text-lg font-semibold text-slate-900">{editId === "new" ? "Nova conta" : "Editar conta"}</h3>
              <input
                type="text"
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                className="input-field"
                placeholder="Nome (ex.: Conta principal)"
              />
              <input
                type="text"
                value={form.ig_user_id}
                onChange={(e) => setForm((f) => ({ ...f, ig_user_id: e.target.value }))}
                className="input-field font-mono text-sm"
                placeholder="ID do usuário Instagram (ig_user_id)"
              />
              <input
                type="password"
                value={form.access_token}
                onChange={(e) => setForm((f) => ({ ...f, access_token: e.target.value }))}
                className="input-field font-mono text-sm"
                placeholder={editId === "new" ? "Token de publicação Graph API (obrigatório)" : "Token postagem (vazio = manter)"}
              />
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Agente Instagram (Direct / comentários)</p>
              <div className="alert-warn mb-2 text-xs leading-relaxed">
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
              <p className="mb-1 text-xs text-slate-600">
                Token separado do de publicação. Use o token com permissões de mensagens conforme o app Meta. Variável na API:{" "}
                <code className="rounded bg-slate-200 px-1">INTERNAL_AGENT_API_SECRET</code> (mesmo valor do header no n8n).
              </p>
              <input
                type="password"
                value={form.agent_access_token}
                onChange={(e) => setForm((f) => ({ ...f, agent_access_token: e.target.value }))}
                className="input-field font-mono text-sm"
                placeholder={editId === "new" ? "Token do agente (opcional)" : "Token agente (vazio = manter)"}
              />
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.agent_ativo}
                  onChange={(e) => setForm((f) => ({ ...f, agent_ativo: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/30"
                />
                Agente ativo (automação pode usar esta conta)
              </label>
              <input
                type="text"
                value={form.agent_nome}
                onChange={(e) => setForm((f) => ({ ...f, agent_nome: e.target.value }))}
                className="input-field"
                placeholder="Nome do assistente (como a IA se apresenta)"
              />
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <strong>O que aparece abaixo</strong> é o que está <strong>salvo no banco</strong> para esta conta. Atualizar o painel no deploy{" "}
                <strong>não troca</strong> texto antigo sozinho. O CONTEXTO DA EMPRESA (dados acima + API) entra no n8n pelo{" "}
                <code className="text-[11px] bg-white px-1 rounded border">agent-config</code>; estes campos são as{" "}
                <strong>instruções fixas</strong> do agente. Para usar os padrões novos do sistema, clique em &quot;Substituir pelos padrões atuais&quot;.
              </p>
              <textarea
                value={form.agent_prompt_comentarios}
                onChange={(e) => setForm((f) => ({ ...f, agent_prompt_comentarios: e.target.value }))}
                className="textarea-field min-h-[120px]"
                placeholder="Prompt para respostas em comentários"
              />
              <textarea
                value={form.agent_prompt_direct}
                onChange={(e) => setForm((f) => ({ ...f, agent_prompt_direct: e.target.value }))}
                className="textarea-field min-h-[120px]"
                placeholder="Prompt para mensagens diretas"
              />
              <div className="flex flex-col gap-2">
                <button type="button" onClick={aplicarPromptsPadraoAtuais} className="btn-primary w-full">
                  Substituir pelos padrões atuais (comentário + Direct)
                </button>
                <button
                  type="button"
                  onClick={aplicarGerarAgente}
                  className="btn-secondary w-full border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                >
                  Ativar agente + nome sugerido (só preenche prompt se estiver vazio)
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleSaveConta}
                  disabled={saving || !form.nome.trim() || !form.ig_user_id.trim() || (editId === "new" && !form.access_token.trim())}
                  className="btn-primary"
                >
                  {saving ? "Salvando..." : editId === "new" ? "Adicionar conta" : "Salvar alterações"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditId(null);
                    setForm(emptyContaForm());
                  }}
                  className="btn-secondary"
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
              className="btn-secondary border-indigo-300 font-semibold text-indigo-700 hover:border-indigo-400 hover:bg-indigo-50"
            >
              + Adicionar conta Instagram
            </button>
          )}
        </div>
      </div>
      )}
    </PageShell>
  );
}
