import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { PageShell } from "../components/layout/PageShell";

export function HomePage() {
  const [apiStatus, setApiStatus] = useState<"checking" | "ok" | "error">("checking");

  useEffect(() => {
    api
      .getHealth()
      .then(() => setApiStatus("ok"))
      .catch(() => setApiStatus("error"));
  }, []);

  const cards = [
    {
      to: "/postador",
      title: "Postador",
      desc: "Legenda com IA, mídia e publicação no Instagram.",
      accent: "from-indigo-500 to-violet-600",
    },
    {
      to: "/postagens",
      title: "Postagens raspadas",
      desc: "Histórico trazido pela automação.",
      accent: "from-slate-600 to-slate-800",
    },
    {
      to: "/cronograma",
      title: "Cronograma",
      desc: "Posts já publicados por este painel.",
      accent: "from-teal-600 to-emerald-700",
    },
    {
      to: "/admin",
      title: "Administração",
      desc: "Contas Instagram, empresa e agente.",
      accent: "from-amber-500 to-orange-600",
    },
  ];

  return (
    <PageShell
      title="Início"
      description={
        <>
          Hub <strong className="text-slate-800">Instagram</strong> da FabriaIA: postador com IA, raspagem de postagens e
          configuração central — com login quando o servidor usa banco multiusuário.
        </>
      }
    >
      <div className="card mb-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Status da API</p>
          <p className="mt-1 text-lg font-medium text-slate-900">
            {apiStatus === "checking" && <span className="text-slate-500">Verificando…</span>}
            {apiStatus === "ok" && (
              <span className="inline-flex items-center gap-2 text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgb(16_185_129/0.8)]" aria-hidden />
                Conectada
              </span>
            )}
            {apiStatus === "error" && <span className="text-red-600">Indisponível</span>}
          </p>
        </div>
        {apiStatus === "error" && (
          <p className="max-w-md text-sm text-slate-600">Confira se a API está no ar e se o painel aponta para a URL correta.</p>
        )}
      </div>

      <p className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">Atalhos</p>
      <ul className="grid gap-4 sm:grid-cols-2">
        {cards.map(({ to, title, desc, accent }) => (
          <li key={to}>
            <Link
              to={to}
              className="group card flex h-full flex-col transition-shadow hover:shadow-md"
            >
              <div
                className={`mb-4 h-1 w-12 rounded-full bg-gradient-to-r ${accent} transition-transform group-hover:scale-x-110`}
                aria-hidden
              />
              <span className="font-display text-lg font-semibold text-slate-900 group-hover:text-indigo-700">{title}</span>
              <span className="mt-1.5 text-sm leading-relaxed text-slate-600">{desc}</span>
              <span className="mt-4 inline-flex items-center text-sm font-semibold text-indigo-600">
                Abrir
                <span className="ml-1 transition-transform group-hover:translate-x-0.5" aria-hidden>
                  →
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
