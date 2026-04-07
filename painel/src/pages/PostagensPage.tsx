import { useState, useEffect } from "react";
import { api, type Postagem } from "../api/client";
import { formatarData } from "../utils/formatDate";

export function PostagensPage() {
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
      <h1 className="text-2xl font-semibold text-gray-900">Postagens raspadas</h1>
      <p className="text-gray-600 mt-2 mb-4">Histórico do Instagram trazido pela raspagem (n8n). Use o botão para atualizar.</p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm">{error}</div>
      )}

      <button
        type="button"
        onClick={handleRaspar}
        disabled={raspando}
        className="mb-6 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
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
                        <img src={p.media_url} alt="" className="w-full h-full object-cover" />
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
