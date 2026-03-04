import { useState } from "react";
import { api } from "../api/client";

type Step = "form" | "review" | "published";

export function Postador() {
  const [descricao, setDescricao] = useState("");
  const [caption, setCaption] = useState<string | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [publishedId, setPublishedId] = useState<string | null>(null);

  const handleGerarCaption = async () => {
    if (!descricao.trim()) {
      setError("Informe a descrição do que deseja postar.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await api.postador.gerarCaption(descricao.trim());
      setCaption(res.caption);
      setMediaUrl(res.media_url ?? null);
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
    try {
      const res = await api.postador.refazerCaption(caption, feedback.trim());
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
    setError(null);
    setLoading(true);
    try {
      const res = await api.postador.publicar(
        caption,
        mediaUrl ?? undefined,
        undefined
      );
      setPublishedId(res.id_container ?? null);
      setStep("published");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao publicar.");
    } finally {
      setLoading(false);
    }
  };

  const handleNovoPost = () => {
    setDescricao("");
    setCaption(null);
    setMediaUrl(null);
    setFeedback("");
    setPublishedId(null);
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
          <button
            type="button"
            onClick={handleGerarCaption}
            disabled={loading || !descricao.trim()}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:pointer-events-none"
          >
            {loading ? "Gerando..." : "Gerar caption"}
          </button>
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
          {mediaUrl && (
            <div>
              <span className="block text-sm font-medium text-gray-700 mb-1">Preview da mídia</span>
              <img src={mediaUrl} alt="Preview" className="max-h-48 rounded-md border border-gray-200" />
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handlePublicar}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
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
          <button
            type="button"
            onClick={handleNovoPost}
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            Criar outro post
          </button>
        </div>
      )}
    </div>
  );
}
