import { useEffect, useState } from "react";
import { api, type CronogramaItem } from "../api/client";

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
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold text-gray-900">Cronograma</h1>
      <p className="mt-2 text-sm text-gray-600">
        Histórico de posts publicados por este painel. Os links podem deixar de funcionar se o conteúdo foi
        removido ou alterado no Instagram — é um registro interno, não um planejamento futuro.
      </p>

      {loading ? (
        <p className="mt-8 text-gray-500 text-sm">Carregando...</p>
      ) : list.length === 0 ? (
        <p className="mt-8 text-gray-500 text-sm">Nenhuma publicação registrada ainda.</p>
      ) : (
        <ul className="mt-8 space-y-3 max-h-[min(70vh,32rem)] overflow-y-auto pr-1">
          {list.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center gap-2 text-sm border border-gray-100 rounded-lg px-3 py-2 bg-gray-50/80"
            >
              <span className="text-gray-500 shrink-0">
                {new Date(item.data_post).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <span className="truncate flex-1 min-w-0 text-gray-800" title={item.caption}>
                {item.caption.length > 80 ? `${item.caption.slice(0, 80)}…` : item.caption}
              </span>
              {item.media_type === "CAROUSEL" && <span className="text-gray-400 shrink-0">Carrossel</span>}
              {item.link_post && (
                <a
                  href={item.link_post}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:underline shrink-0 font-medium"
                >
                  Ver no Instagram
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
