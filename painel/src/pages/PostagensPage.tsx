import { useState, useEffect } from "react";
import { api, type Postagem } from "../api/client";
import { formatarData } from "../utils/formatDate";
import { PageShell } from "../components/layout/PageShell";

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
    <PageShell
      title="Postagens raspadas"
      description="Histórico do Instagram trazido pela raspagem (n8n). Use o botão para atualizar."
    >
      {error && <div className="alert-error mb-6">{error}</div>}

      <button type="button" onClick={handleRaspar} disabled={raspando} className="btn-primary mb-8">
        {raspando ? "Raspando…" : "Raspar postagens"}
      </button>

      {loading ? (
        <p className="text-sm text-slate-500">Carregando…</p>
      ) : postagens.length === 0 ? (
        <div className="card border-dashed border-slate-300 bg-slate-50/50 text-center text-sm text-slate-600">
          Nenhuma postagem. Clique em &quot;Raspar postagens&quot; para disparar a raspagem no n8n.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-soft">
          <table className="min-w-full divide-y divide-slate-200">
            <thead>
              <tr className="bg-slate-50/90">
                <th scope="col" className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Mídia
                </th>
                <th scope="col" className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Legenda
                </th>
                <th scope="col" className="hidden px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 sm:table-cell">
                  Data
                </th>
                <th scope="col" className="hidden px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 md:table-cell">
                  Tipo
                </th>
                <th scope="col" className="hidden px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 lg:table-cell">
                  Status
                </th>
                <th scope="col" className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Link
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {postagens.map((p, i) => (
                <tr key={p.id ?? i} className="transition-colors hover:bg-slate-50/80">
                  <td className="px-4 py-3">
                    {p.media_url ? (
                      <a
                        href={p.link_post ?? "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
                      >
                        <img src={p.media_url} alt="" className="h-full w-full object-cover" />
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="max-w-[280px] px-4 py-3 sm:max-w-[320px]">
                    <p className="line-clamp-3 text-sm text-slate-800" title={p.caption_post ?? undefined}>
                      {p.caption_post || "—"}
                    </p>
                    {p.hashtags && (
                      <p className="mt-1 truncate text-xs text-slate-500" title={p.hashtags}>
                        {p.hashtags}
                      </p>
                    )}
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3 text-sm text-slate-600 sm:table-cell">
                    {formatarData(p.data_post)}
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <span className="text-xs font-medium text-slate-600">{p.media_type ?? "—"}</span>
                  </td>
                  <td className="hidden px-4 py-3 lg:table-cell">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        p.processado ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
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
                        className="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-indigo-100 hover:text-indigo-800"
                      >
                        Abrir
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}
