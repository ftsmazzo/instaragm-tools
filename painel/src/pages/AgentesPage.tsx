import { Link } from "react-router-dom";
import { PageShell } from "../components/layout/PageShell";

export function AgentesPage() {
  return (
    <PageShell
      title="Agentes e leads"
      description={
        <>
          A configuração do <strong className="text-slate-800">agente Instagram</strong> (token separado, prompts, ativação) fica em{" "}
          <strong className="text-slate-800">Administração</strong>, ao editar cada conta — não nesta página.
        </>
      }
    >
      <div className="card mb-6 border-indigo-200/80 bg-gradient-to-br from-indigo-50/90 to-white">
        <p className="font-display text-lg font-semibold text-indigo-950">Onde configurar o agente</p>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-indigo-950/90">
          <li>Abra Administração (menu lateral).</li>
          <li>Na lista de contas, clique em <strong>Editar</strong> na conta desejada (ou adicione uma conta).</li>
          <li>
            Role até a seção <strong>Agente Instagram (Direct / comentários)</strong>: token do agente, prompts e botão para gerar perfil padrão.
          </li>
        </ol>
        <Link to="/admin" className="btn-primary mt-5 inline-flex">
          Ir para Administração
        </Link>
      </div>
      <div className="card border-dashed border-amber-300/80 bg-amber-50/40">
        <p className="font-semibold text-amber-950">Em breve nesta rota</p>
        <p className="mt-2 text-sm leading-relaxed text-amber-900/85">
          Visualização de leads e conversas integrada ao n8n / automação — por enquanto o fluxo usa a API interna configurada na admin (token + prompts salvos no banco).
        </p>
      </div>
    </PageShell>
  );
}
