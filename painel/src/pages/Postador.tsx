import { useState, useEffect } from "react";
import { api } from "../api/client";

const STORAGE_KEY = "postador_ia";

const PROVIDERS = [
  { id: "openai", label: "OpenAI (GPT)" },
  { id: "claude", label: "Claude (Anthropic)" },
] as const;

const MODELS_OPENAI = [
  { id: "gpt-4.1", label: "GPT-4.1" },
  { id: "gpt-4o", label: "GPT-4o" },
  { id: "gpt-5.2", label: "GPT-5.2" },
];

const MODELS_CLAUDE = [
  { id: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5" },
  { id: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
  { id: "claude-3-opus-20240229", label: "Claude 3 Opus" },
];

function loadSavedIA(): { provider: string; model: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { provider?: string; model?: string };
      if (parsed.provider && parsed.model) return { provider: parsed.provider, model: parsed.model };
    }
  } catch {
    // ignore
  }
  return { provider: "openai", model: "gpt-4.1" };
}

function saveIA(provider: string, model: string) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ provider, model }));
  } catch {
    // ignore
  }
}

type Step = "form" | "review" | "published";

export function Postador() {
  const [descricao, setDescricao] = useState("");
  const [urlImovel, setUrlImovel] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [caption, setCaption] = useState<string | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"IMAGE" | "REELS" | undefined>(undefined);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [publishedId, setPublishedId] = useState<string | null>(null);
  const [linkPost, setLinkPost] = useState<string | null>(null);

  const [provider, setProvider] = useState(loadSavedIA().provider);
  const [model, setModel] = useState(loadSavedIA().model);

  const modelsList = provider === "claude" ? MODELS_CLAUDE : MODELS_OPENAI;
  const currentModelInList = modelsList.some((m) => m.id === model);

  useEffect(() => {
    saveIA(provider, model);
  }, [provider, model]);

  useEffect(() => {
    if (!currentModelInList && modelsList.length) setModel(modelsList[0].id);
  }, [provider]);

  const handleGerarCaption = async () => {
    if (!descricao.trim()) {
      setError("Informe a descrição do que deseja postar.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await api.postador.gerarCaption(
        descricao.trim(),
        arquivo ?? undefined,
        provider,
        currentModelInList ? model : modelsList[0]?.id ?? model
      );
      setCaption(res.caption);
      setMediaUrl(res.media_url ?? null);
      setMediaType(res.media_type === "REELS" ? "REELS" : res.media_type === "IMAGE" ? "IMAGE" : undefined);
      if (arquivo && arquivo.type.startsWith("image/")) {
        const url = URL.createObjectURL(arquivo);
        setPreviewUrl(url);
      } else if (res.media_url && res.media_type === "IMAGE") {
        setPreviewUrl(res.media_url);
      } else {
        setPreviewUrl(null);
      }
      setStep("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao gerar caption.");
    } finally {
      setLoading(false);
    }
  };

  const handleRefazer = async () => {
    if (!caption || !feedback.trim()) {
      setError("Digite o que deseja alterar ou melhorar no caption.");
      return;
    }
    setError(null);
    setLoading(true);
    const effectiveModel = currentModelInList ? model : modelsList[0]?.id ?? model;
    try {
      const res = await api.postador.refazerCaption(
        caption,
        feedback.trim(),
        undefined,
        provider,
        effectiveModel
      );
      setCaption(res.caption);
      setMediaUrl(res.media_url ?? null);
      setFeedback("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao refazer caption.");
    } finally {
      setLoading(false);
    }
  };

  const handlePublicar = async () => {
    if (!caption) return;
    if (!mediaUrl) {
      setError("Para publicar no feed é necessário uma imagem ou vídeo. Envie um arquivo ao gerar o caption (e configure o MinIO na API).");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await api.postador.publicar(
        caption,
        mediaUrl,
        mediaType ?? "IMAGE"
      );
      setPublishedId(res.id_container ?? null);
      setLinkPost(res.link_post ?? null);
      setStep("published");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao publicar.");
    } finally {
      setLoading(false);
    }
  };

  const handleGerarPorUrl = async () => {
    if (!urlImovel.trim()) {
      setError("Cole o link da página do imóvel.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await api.postador.gerarPorUrl(
        urlImovel.trim(),
        provider,
        currentModelInList ? model : modelsList[0]?.id ?? model
      );
      setCaption(res.caption);
      setMediaUrl(res.media_url ?? null);
      setMediaType("IMAGE");
      setPreviewUrl(res.media_url ?? null);
      setStep("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao gerar post a partir do link.");
    } finally {
      setLoading(false);
    }
  };

  const handleNovoPost = () => {
    setDescricao("");
    setUrlImovel("");
    setArquivo(null);
    setCaption(null);
    setMediaUrl(null);
    setMediaType(undefined);
    setPreviewUrl(null);
    setFeedback("");
    setPublishedId(null);
    setLinkPost(null);
    setStep("form");
    setError(null);
  };

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-semibold text-gray-900">Postador automático</h1>
      <p className="text-gray-600 mt-1 mb-6">
        Descreva o que deseja postar. O caption será gerado para sua aprovação antes de publicar.
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm">
          {error}
        </div>
      )}

      {step === "form" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div>
              <label htmlFor="provider" className="block text-sm font-medium text-gray-700 mb-1">
                Provedor de IA
              </label>
              <select
                id="provider"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                disabled={loading}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              >
                {PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="model" className="block text-sm font-medium text-gray-700 mb-1">
                Modelo / versão
              </label>
              <select
                id="model"
                value={currentModelInList ? model : modelsList[0]?.id ?? ""}
                onChange={(e) => setModel(e.target.value)}
                disabled={loading}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              >
                {modelsList.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="descricao" className="block text-sm font-medium text-gray-700 mb-1">
              Descrição do post *
            </label>
            <textarea
              id="descricao"
              rows={5}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="Ex.: Casa em condomínio, 3 quartos, Ribeirão Preto..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              disabled={loading}
            />
          </div>
          <div>
            <label htmlFor="arquivo" className="block text-sm font-medium text-gray-700 mb-1">
              Vídeo ou imagem (opcional)
            </label>
            <input
              id="arquivo"
              type="file"
              accept="image/*,video/*"
              className="block w-full text-sm text-gray-600 file:mr-4 file:rounded-md file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
              disabled={loading}
            />
            {arquivo && (
              <p className="mt-1 text-sm text-gray-500">
                {arquivo.name} ({(arquivo.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleGerarCaption}
              disabled={loading || !descricao.trim()}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:pointer-events-none"
            >
              {loading ? "Gerando..." : "Gerar caption"}
            </button>
          </div>

          <div className="pt-4 mt-4 border-t border-gray-200">
            <p className="text-sm font-medium text-gray-700 mb-2">Ou use o link do imóvel</p>
            <p className="text-xs text-gray-500 mb-2">
              Cole a URL da página de detalhes do imóvel. O sistema raspa os dados, baixa a imagem (via Cloudinary) e gera o caption.
            </p>
            <div className="flex flex-wrap gap-2">
              <input
                type="url"
                value={urlImovel}
                onChange={(e) => setUrlImovel(e.target.value)}
                placeholder="https://.../imoveis/..."
                className="flex-1 min-w-[200px] rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                disabled={loading}
              />
              <button
                type="button"
                onClick={handleGerarPorUrl}
                disabled={loading || !urlImovel.trim()}
                className="inline-flex items-center px-4 py-2 border border-indigo-200 text-sm font-medium rounded-md text-indigo-700 bg-indigo-50 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:pointer-events-none"
              >
                {loading ? "Processando..." : "Gerar post do link"}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === "review" && caption && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Caption para aprovação
            </label>
            <pre className="w-full rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800 whitespace-pre-wrap font-sans max-h-64 overflow-y-auto">
              {caption}
            </pre>
          </div>
          {(previewUrl || mediaUrl || (arquivo && arquivo.type.startsWith("video/"))) && (
            <div>
              <span className="block text-sm font-medium text-gray-700 mb-1">Mídia do post</span>
              {mediaType === "REELS" || arquivo?.type.startsWith("video/") ? (
                <p className="text-sm text-gray-600 py-2">Vídeo: {arquivo?.name ?? "Enviado"}</p>
              ) : (previewUrl || mediaUrl) ? (
                <img src={previewUrl ?? mediaUrl ?? ""} alt="Preview" className="max-h-48 rounded-md border border-gray-200" />
              ) : null}
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            {!mediaUrl && (
              <p className="text-amber-700 text-sm">Envie uma imagem ou vídeo ao gerar o caption para poder publicar (e configure MinIO na API).</p>
            )}
            <button
              type="button"
              onClick={handlePublicar}
              disabled={loading || !mediaUrl}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Publicando..." : "Aprovar e publicar"}
            </button>
            <div className="flex-1 min-w-[200px] flex flex-col gap-2">
              <textarea
                rows={2}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                placeholder="O que deseja alterar? (ex.: deixar mais curto, incluir #imoveis)"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                disabled={loading}
              />
              <button
                type="button"
                onClick={handleRefazer}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                Quero alterar (refazer caption)
              </button>
            </div>
          </div>
        </div>
      )}

      {step === "published" && (
        <div className="rounded-md bg-green-50 border border-green-200 p-4">
          <p className="text-green-800 font-medium">Post publicado com sucesso.</p>
          {publishedId && (
            <p className="text-green-700 text-sm mt-1">ID: {publishedId}</p>
          )}
          {linkPost && (
            <p className="mt-2">
              <a href={linkPost} target="_blank" rel="noopener noreferrer" className="text-green-700 underline">
                Ver no Instagram
              </a>
            </p>
          )}
          <button
            type="button"
            onClick={handleNovoPost}
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            Criar outro post
          </button>
        </div>
      )}

      <CronogramaList />
    </div>
  );
}

function CronogramaList() {
  const [list, setList] = useState<Array<{ id: string; caption: string; media_url: string | null; link_post: string | null; data_post: string }>>([]);
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    api.postador
      .getCronograma()
      .then((r) => setList(r.cronograma ?? []))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  if (list.length === 0 && !loading) return null;

  return (
    <div className="mt-10 pt-6 border-t border-gray-200">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">Cronograma / posts publicados</h2>
      {loading ? (
        <p className="text-gray-500 text-sm">Carregando...</p>
      ) : (
        <ul className="space-y-2 max-h-64 overflow-y-auto">
          {list.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-2 text-sm border-b border-gray-100 pb-2">
              <span className="text-gray-500 shrink-0">
                {new Date(item.data_post).toLocaleString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
              <span className="truncate max-w-[200px] text-gray-700" title={item.caption}>
                {item.caption.length > 50 ? `${item.caption.slice(0, 50)}…` : item.caption}
              </span>
              {item.link_post && (
                <a href={item.link_post} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline shrink-0">
                  Ver
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
