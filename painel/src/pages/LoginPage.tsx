import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, setAuthToken, type AuthStatus } from "../api/client";

export function LoginPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .getAuthStatus()
      .then((s) => {
        setStatus(s);
        if (s.allowRegister && !s.hasUsers) setMode("register");
      })
      .catch(() => setStatus({ database: false, hasUsers: false, allowRegister: false }));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "register") {
        const r = await api.register(email.trim(), password, organizationName.trim() || "Minha empresa");
        setAuthToken(r.token);
        navigate("/admin", { replace: true });
      } else {
        const r = await api.login(email.trim(), password);
        setAuthToken(r.token);
        navigate("/admin", { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha na autenticação");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <h1 className="text-xl font-semibold text-gray-900 text-center">Máquina de vendas</h1>
        <p className="text-sm text-gray-500 text-center mt-1 mb-6">FabriaIA · Acesso ao painel</p>

        {status?.database === false && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-900 text-sm">
            API sem <code className="text-xs">DATABASE_URL</code>: o login multiusuário não está ativo. Use{" "}
            <Link to="/admin" className="underline font-medium">
              Administração
            </Link>{" "}
            no modo legado.
          </div>
        )}

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm">{error}</div>}

        <div className="flex rounded-lg bg-gray-100 p-1 mb-6">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              mode === "login" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600"
            }`}
          >
            Entrar
          </button>
          {status?.allowRegister && (
            <button
              type="button"
              onClick={() => setMode("register")}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === "register" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600"
              }`}
            >
              Criar conta
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome da empresa / workspace</label>
              <input
                type="text"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder="Ex.: Imobiliária Silva"
                autoComplete="organization"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
            <input
              type="password"
              required
              minLength={mode === "register" ? 8 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              autoComplete={mode === "register" ? "new-password" : "current-password"}
            />
            {mode === "register" && <p className="text-xs text-gray-500 mt-1">Mínimo 8 caracteres.</p>}
          </div>
          <button
            type="submit"
            disabled={loading || status?.database === false}
            className="w-full py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "Aguarde..." : mode === "register" ? "Criar conta e entrar" : "Entrar"}
          </button>
        </form>

        <p className="text-center mt-6 text-sm text-gray-500">
          <Link to="/" className="text-indigo-600 hover:underline">
            Voltar ao início
          </Link>
        </p>
      </div>
    </div>
  );
}
