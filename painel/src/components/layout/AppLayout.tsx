import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { navGroups, itemsByGroup } from "../../config/navigation";
import { clearAuthToken, getAuthToken } from "../../api/client";

export function AppLayout() {
  const loc = useLocation();
  const navigate = useNavigate();
  const [hasToken, setHasToken] = useState(() => Boolean(getAuthToken()));
  useEffect(() => {
    const sync = () => setHasToken(Boolean(getAuthToken()));
    window.addEventListener("mv-auth-changed", sync);
    return () => window.removeEventListener("mv-auth-changed", sync);
  }, []);

  const isActive = (path: string) => {
    if (path === "/") return loc.pathname === "/";
    return loc.pathname === path || loc.pathname.startsWith(`${path}/`);
  };

  return (
    <div className="min-h-screen flex bg-slate-100">
      <aside className="flex w-64 shrink-0 flex-col border-r border-slate-800/60 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-slate-300 shadow-lift">
        <div className="border-b border-white/10 px-5 py-6">
          <Link to="/" className="block font-display text-lg font-semibold tracking-tight text-white">
            Máquina de vendas
          </Link>
          <p className="mt-1 text-xs font-medium uppercase tracking-widest text-slate-500">FabriaIA · Painel</p>
          <div className="mt-4">
            {hasToken ? (
              <button
                type="button"
                onClick={() => {
                  clearAuthToken();
                  navigate("/login", { replace: true });
                }}
                className="w-full rounded-lg px-2 py-2 text-left text-sm text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
              >
                Sair
              </button>
            ) : (
              <Link
                to="/login"
                className="inline-flex text-sm font-medium text-indigo-300 transition-colors hover:text-indigo-200"
              >
                Entrar
              </Link>
            )}
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
          {navGroups.map((group) => {
            const items = itemsByGroup(group.id);
            if (items.length === 0) return null;
            return (
              <div key={group.id}>
                <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{group.label}</p>
                <ul className="space-y-0.5">
                  {items.map(({ path, label }) => {
                    const active = isActive(path);
                    return (
                      <li key={path}>
                        <Link
                          to={path}
                          className={`block rounded-xl border-l-4 py-2.5 pl-3 pr-3 text-sm transition-colors ${
                            active
                              ? "border-indigo-400 bg-white/10 font-medium text-white shadow-sm"
                              : "border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-100"
                          }`}
                        >
                          {label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>
        <div className="border-t border-white/10 px-5 py-4 text-[11px] leading-relaxed text-slate-500">
          Próximo passo: CRM e dashboard de dados.
        </div>
      </aside>
      <main className="min-h-0 min-w-0 flex-1 overflow-x-auto">
        <Outlet />
      </main>
    </div>
  );
}
