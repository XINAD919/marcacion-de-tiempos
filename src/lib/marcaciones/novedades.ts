import { lateMinutes } from "@/lib/server/markingRules";
import { horaEnDia } from "./correcciones";

export type Novedad =
  | { tipo: "tarde"; minutos: number }
  | { tipo: "salida-temprana" }
  | { tipo: "manual" }
  | { tipo: "qr" };

export function horaFinEfectiva(user: { horaFin: string | null; sede: { horaCierre: string | null } | null }): string | null {
  return user.horaFin ?? user.sede?.horaCierre ?? null;
}

export function novedadesDe(
  marca: { tipo: string; metodo: string; marcadoEn: Date },
  ctx: { primeraEntradaDelDia: boolean; horaInicio: string | null; horaFin: string | null; toleranciaMin: number }
): Novedad[] {
  const novedades: Novedad[] = [];

  if (marca.tipo === "IN" && ctx.primeraEntradaDelDia) {
    const minutos = lateMinutes(marca.marcadoEn, ctx.horaInicio, ctx.toleranciaMin);
    if (minutos !== null) novedades.push({ tipo: "tarde", minutos });
  }

  const fin = marca.tipo === "OUT" ? horaEnDia(marca.marcadoEn, ctx.horaFin) : null;
  const salidaTemprana = fin !== null && marca.marcadoEn < fin;
  if (salidaTemprana) novedades.push({ tipo: "salida-temprana" });
  if (marca.metodo === "manual" && !salidaTemprana) novedades.push({ tipo: "manual" });
  if (marca.metodo === "qr") novedades.push({ tipo: "qr" });

  return novedades;
}

/** "tarde" se pinta como "N min tarde". */
export const NOVEDAD_LABEL: Record<Novedad["tipo"], string> = {
  tarde: "Tarde",
  "salida-temprana": "Salida temprana",
  manual: "Manual",
  qr: "QR",
};
