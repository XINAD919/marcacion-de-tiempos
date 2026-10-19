import { isSameDay, startOfDay, toDayParam } from "@/lib/reportes/dates";
import type { AttendanceMark } from "@/lib/server/workedTime";

export interface Marca extends AttendanceMark {
  id: string;
}

export type Inconsistencia =
  | { tipo: "sin-salida"; marca: Marca } // IN de un día anterior a hoy sin OUT a continuación ese día
  | { tipo: "sin-entrada"; marca: Marca }; // OUT sin IN inmediatamente antes ese día (también hoy)

const byTime = (a: AttendanceMark, b: AttendanceMark) => a.marcadoEn.getTime() - b.marcadoEn.getTime();

/** Agrupa por día local (clave `toDayParam`); cada lista queda ordenada ascendente. */
export function marcasPorDia<T extends AttendanceMark>(marcas: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const marca of [...marcas].sort(byTime)) {
    const key = toDayParam(marca.marcadoEn);
    const list = map.get(key);
    if (list) list.push(marca);
    else map.set(key, [marca]);
  }
  return map;
}

/** Marcas válidas sin pareja, por día (el día de la marca), días más recientes primero. */
export function findInconsistencias(marcas: Marca[], now: Date): Inconsistencia[] {
  const hoy = startOfDay(now).getTime();
  const dias = [...marcasPorDia(marcas).entries()].sort((a, b) => b[0].localeCompare(a[0]));
  const result: Inconsistencia[] = [];

  for (const [, dia] of dias) {
    dia.forEach((marca, i) => {
      if (marca.tipo === "IN") {
        const esPasado = startOfDay(marca.marcadoEn).getTime() < hoy;
        if (esPasado && dia[i + 1]?.tipo !== "OUT") result.push({ tipo: "sin-salida", marca });
      } else if (marca.tipo === "OUT" && dia[i - 1]?.tipo !== "IN") {
        result.push({ tipo: "sin-entrada", marca });
      }
    });
  }
  return result;
}

/** Última marca de hoy si es una entrada (jornada en curso). */
export function jornadaAbiertaHoy(marcas: Marca[], now: Date): Marca | null {
  const hoy = marcas.filter((m) => isSameDay(m.marcadoEn, now)).sort(byTime);
  const ultima = hoy[hoy.length - 1];
  return ultima?.tipo === "IN" ? ultima : null;
}

/** ¿Insertar `nueva` en `dia` mantiene la alternancia ENTRADA/SALIDA? */
export function encaja(dia: Marca[], nueva: { tipo: string; marcadoEn: Date }): boolean {
  const t = nueva.marcadoEn.getTime();
  const ordenado = [...dia].sort(byTime);
  const anterior = [...ordenado].reverse().find((m) => m.marcadoEn.getTime() <= t);
  const siguiente = ordenado.find((m) => m.marcadoEn.getTime() > t);
  const opuesto = (tipo: string) => (tipo === "IN" ? "OUT" : "IN");

  const okAnterior = anterior ? anterior.tipo === opuesto(nueva.tipo) : nueva.tipo === "IN";
  const okSiguiente = siguiente ? siguiente.tipo === opuesto(nueva.tipo) : true;
  return okAnterior && okSiguiente;
}
