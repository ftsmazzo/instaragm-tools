/** Formata data ISO para exibição curta em pt-BR. */
export function formatarData(s?: string | null): string {
  if (!s) return "—";
  try {
    const d = new Date(s);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return s;
  }
}
