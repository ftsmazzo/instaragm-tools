import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { api, clearAuthToken, getAuthToken } from "../../api/client";

/**
 * Com DATABASE_URL (modo workspace), exige JWT válido para ver o painel.
 * Sem banco (legado), libera tudo como antes.
 */
export function RequireSession() {
  const navigate = useNavigate();
  const location = useLocation();
  const [ready, setReady] = useState<"loading" | "ok">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await api.getAuthStatus();
        if (cancelled) return;
        if (!status.database || status.authMode !== "workspace") {
          setReady("ok");
          return;
        }
        const token = getAuthToken();
        if (!token) {
          navigate("/login", { replace: true, state: { from: location.pathname } });
          return;
        }
        try {
          await api.getMe();
          if (!cancelled) setReady("ok");
        } catch {
          clearAuthToken();
          if (!cancelled) {
            navigate("/login", { replace: true, state: { from: location.pathname } });
          }
        }
      } catch {
        if (!cancelled) setReady("ok");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate, location.pathname]);

  if (ready === "loading") {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-gray-500 text-sm">
        Verificando sessão...
      </div>
    );
  }

  return <Outlet />;
}
