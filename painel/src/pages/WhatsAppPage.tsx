import { PageShell } from "../components/layout/PageShell";

export function WhatsAppPage() {
  return (
    <PageShell title="WhatsApp" description="Instância e conexão de WhatsApp para o fluxo de qualificação.">
      <div className="card border-dashed border-emerald-300/80 bg-emerald-50/35">
        <p className="font-semibold text-emerald-950">Em breve</p>
        <p className="mt-2 text-sm leading-relaxed text-emerald-900/85">
          A conexão e o status da instância aparecerão aqui quando o módulo estiver pronto.
        </p>
      </div>
    </PageShell>
  );
}
