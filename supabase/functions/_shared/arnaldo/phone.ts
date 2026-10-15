export function normalizeBrPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = String(raw).split("@")[0].replace(/\D/g, "");
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) d = d.slice(2);
  if (d.length === 10) {
    const primeiro = d[2];
    if ("6789".includes(primeiro)) d = d.slice(0, 2) + "9" + d.slice(2); // celular antigo sem o 9
  }
  if (d.length !== 10 && d.length !== 11) return null;
  return "55" + d;
}
