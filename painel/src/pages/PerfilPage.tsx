import { PageShell } from "../components/layout/PageShell";

export function PerfilPage() {
  return (
    <PageShell
      title="Perfil"
      description="Dados do usuário, alteração de senha e preferências da conta."
    >
      <div className="card border-dashed border-slate-300 bg-slate-50/50">
        <p className="font-semibold text-slate-800">Em breve</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Gestão de perfil e segurança será expandida na próxima etapa do produto.
        </p>
      </div>
    </PageShell>
  );
}
