import { Link } from "react-router-dom";

export function AgentesPage() {
  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-semibold text-gray-900">Agentes e leads</h1>
      <p className="text-gray-600 mt-2">
        A configuração do <strong>agente Instagram</strong> (token separado, prompts, ativação) fica em{" "}
        <strong>Administração</strong>, ao editar cada conta — não nesta página.
      </p>
      <div className="mt-4 rounded-lg border border-indigo-200 bg-indigo-50/80 p-4 text-sm text-indigo-950">
        <p className="font-medium">Onde configurar o agente</p>
        <ol className="mt-2 list-decimal list-inside space-y-1 text-indigo-900/90">
          <li>Abra Administração (menu lateral).</li>
          <li>Na lista de contas, clique em <strong>Editar</strong> na conta desejada (ou adicione uma conta).</li>
          <li>Role até a seção <strong>Agente Instagram (Direct / comentários)</strong>: token do agente, prompts e botão para gerar perfil padrão.</li>
        </ol>
        <Link
          to="/admin"
          className="mt-4 inline-block rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Ir para Administração
        </Link>
      </div>
      <div className="mt-6 rounded-lg border border-dashed border-amber-200 bg-amber-50/50 p-4 text-sm text-amber-900">
        <p className="font-medium">Em breve nesta rota</p>
        <p className="mt-1 text-amber-800/90">
          Visualização de leads e conversas integrada ao n8n / automação — por enquanto o fluxo usa a API interna configurada na admin (token + prompts salvos no banco).
        </p>
      </div>
    </div>
  );
}
