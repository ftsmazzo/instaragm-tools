import { Link, useLocation } from "react-router-dom";
import { navGroups, itemsByGroup } from "../../config/navigation";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const loc = useLocation();

  const isActive = (path: string) => {
    if (path === "/") return loc.pathname === "/";
    return loc.pathname === path || loc.pathname.startsWith(`${path}/`);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="w-60 shrink-0 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-100">
          <Link to="/" className="font-semibold text-gray-900 tracking-tight">
            FabriaIA
          </Link>
          <p className="text-xs text-gray-500 mt-0.5">Painel</p>
        </div>
        <nav className="p-3 flex-1 overflow-y-auto space-y-5">
          {navGroups.map((group) => {
            const items = itemsByGroup(group.id);
            if (items.length === 0) return null;
            return (
              <div key={group.id}>
                <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  {group.label}
                </p>
                <ul className="space-y-0.5">
                  {items.map(({ path, label }) => (
                    <li key={path}>
                      <Link
                        to={path}
                        className={`block px-3 py-2 rounded-md text-sm transition-colors ${
                          isActive(path)
                            ? "bg-indigo-50 text-indigo-900 font-medium"
                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                        }`}
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 min-w-0 overflow-x-auto">{children}</main>
    </div>
  );
}
