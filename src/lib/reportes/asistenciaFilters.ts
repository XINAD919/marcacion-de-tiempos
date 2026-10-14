import type { EstadoAsistencia } from "./attendance";
import { addDays, formatDayShort, parseDayParam, startOfDay, toDayParam } from "./dates";
import { type Params, buildHref, toQuery } from "./href";

export type AsistenciaFilters = {
  fecha?: string;
  q?: string;
  universidad?: string;
  entidad?: string;
  estado?: EstadoAsistencia;
  page?: number;
};

type SearchParams = Record<string, string | string[] | undefined>;

export const ASISTENCIA_PATH = "/admin/reportes";
const EXPORT_PATH = "/api/reportes/asistencia/export";
export const ASISTENCIA_ORDER = ["fecha", "q", "universidad", "entidad", "estado", "page"] as const;
const EXPORT_ORDER = ["fecha", "q", "universidad", "entidad", "estado"] as const;
const ESTADOS: EstadoAsistencia[] = ["presente", "marcaron", "tarde", "sin-marcar"];

export function estadoAsistenciaOpciones(esHoy: boolean): { value: EstadoAsistencia; label: string }[] {
  return [
    { value: "presente", label: esHoy ? "Presentes ahora" : "Sin salida registrada" },
    { value: "marcaron", label: "Marcaron entrada" },
    { value: "tarde", label: "Llegaron tarde" },
    { value: "sin-marcar", label: "Sin marcar" },
  ];
}

function first(value: string | string[] | undefined): string | undefined {
  const text = (Array.isArray(value) ? value[0] : value)?.trim();
  return text ? text : undefined;
}

export function parseAsistenciaFilters(params: SearchParams, today: Date): AsistenciaFilters {
  const day = parseDayParam(first(params.fecha));
  const estado = first(params.estado) as EstadoAsistencia | undefined;
  const page = Number(first(params.page));
  return {
    fecha: day && day.getTime() < startOfDay(today).getTime() ? toDayParam(day) : undefined,
    q: first(params.q),
    universidad: first(params.universidad),
    entidad: first(params.entidad),
    estado: estado && ESTADOS.includes(estado) ? estado : undefined,
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

export function resolveDay(filters: AsistenciaFilters, today: Date): Date {
  return (filters.fecha ? parseDayParam(filters.fecha) : null) ?? startOfDay(today);
}

export function asistenciaHref(current: AsistenciaFilters, changes: Partial<AsistenciaFilters>): string {
  return buildHref(ASISTENCIA_PATH, { ...current }, { ...changes }, { order: ASISTENCIA_ORDER });
}

export function asistenciaExportHref(filters: AsistenciaFilters): string {
  const query = toQuery({ ...filters } as Params, { order: EXPORT_ORDER });
  return query ? `${EXPORT_PATH}?${query}` : EXPORT_PATH;
}

export function fechaOpciones(today: Date, count = 7): { value: string; label: string; chip: string }[] {
  return Array.from({ length: count }, (_, i) => {
    const day = addDays(startOfDay(today), -(i + 1));
    const label = i === 0 ? `Ayer · ${formatDayShort(day)}` : formatDayShort(day);
    return { value: toDayParam(day), label, chip: `Día: ${formatDayShort(day)}` };
  });
}