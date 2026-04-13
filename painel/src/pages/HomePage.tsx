import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

export function HomePage() {
  const [apiStatus, setApiStatus] = useState<"checking" | "ok" | "error">("checking");

  useEffect(() => {
    api
      .getHealth()
      .then(() => setApiStatus("ok"))
      .catch(() => setApiStatus("error"));
  }, []);

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-semibold text-gray-900">Máquina de vendas</h1>
      <p className="text-gray-600 mt-2 mb-6">
        FabriaIA — hub para Instagram: <strong>Postador</strong> com IA, <strong>Postagens raspadas</strong>,{" "}
        <strong>Administração</strong> das contas (com login quando o servidor usa banco multiusuário).
      </p>

      <div className="rounded-lg border border-gray-200 bg-white p-4 mb-6">
        <p className="text-sm font-medium text-gray-700 mb-2">Status da API</p>
        <p className="text-sm">
          {apiStatus === "checking" && <span className="text-gray-500">Verificando...</span>}
          {apiStatus === "ok" && <span className="text-green-600 font-medium">Conectada</span>}
          {apiStatus === "error" && <span className="text-red-600 font-medium">Indisponível</span>}
        </p>
      </div>

      <p className="text-sm text-gray-600 mb-3">Atalhos:</p>
      <ul className="flex flex-wrap gap-2">
        <li>
          <Link to="/postador" className="inline-flex px-3 py-1.5 rounded-md bg-indigo-50 text-indigo-800 text-sm font-medium hover:bg-indigo-100">
            Postador
          </Link>
        </li>
        <li>
          <Link to="/postagens" className="inline-flex px-3 py-1.5 rounded-md bg-gray-100 text-gray-800 text-sm font-medium hover:bg-gray-200">
            Postagens raspadas
          </Link>
        </li>
        <li>
          <Link to="/admin" className="inline-flex px-3 py-1.5 rounded-md bg-gray-100 text-gray-800 text-sm font-medium hover:bg-gray-200">
            Administração
          </Link>
        </li>
      </ul>
    </div>
  );
}
