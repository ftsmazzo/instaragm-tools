import { useEffect, useState } from "react";
import { api, type CronogramaItem } from "../api/client";
import { PageShell } from "../components/layout/PageShell";

export function CronogramaPage() {
  const [list, setList] = useState<CronogramaItem[]>([]);
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

  return (
    <PageShell
      title="Cronograma"
      description={
        <>
          Histórico de posts publicados por este painel. Os links podem deixar de funcionar se o conteúdo foi removido ou alterado no
          Instagram — é um registro interno, não um planejamento futuro.
        </>
      }
    >
      {loading ? (
        <p className="text-sm text-slate-500">Carregando…</p>
      ) : list.length === 0 ? (
        <div className="card border-dashed border-slate-300 bg-slate-50/50 text-center text-sm text-slate-600">
          Nenhuma publicação registrada ainda.
        </div>
      ) : (
        <ul className="max-h-[min(70vh,32rem)] space-y-3 overflow-y-auto pr-1">
          {list.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200/90 bg-white px-4 py-3 text-sm shadow-sm"
            >
              <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-slate-400">
                {new Date(item.data_post).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <span className="min-w-0 flex-1 truncate text-slate-800" title={item.caption}>
                {item.caption.length > 80 ? `${item.caption.slice(0, 80)}…` : item.caption}
              </span>
              {item.media_type === "CAROUSEL" && <span className="shrink-0 text-xs text-slate-400">Carrossel</span>}
              {item.link_post && (
                <a
                  href={item.link_post}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-sm font-semibold text-indigo-600 hover:text-indigo-500"
                >
                  Ver no Instagram
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
