import { RIESGO_DEFAULT, RIESGO_OFF, RIESGO_OPCIONES } from "./cumplimiento";
import { type Params, buildHref, toQuery } from "./href";

export type CumplimientoFilters = {
  q?: string; universidad?: string; entidad?: string; riesgo?: string; page?: number;
};

type SearchParams = Record<string, string | string[] | undefined>;

export const CUMPLIMIENTO_PATH = "/admin/reportes/cumplimiento";
const EXPORT_PATH = "/api/reportes/export";
export const CUMPLIMIENTO_ORDER = ["q", "universidad", "entidad", "riesgo", "page"] as const;
const EXPORT_ORDER = ["q", "universidad", "entidad"] as const;
export const CUMPLIMIENTO_DEFAULTS = { riesgo: RIESGO_DEFAULT };
const RIESGOS_VALIDOS = [...RIESGO_OPCIONES.map((option) => option.value), RIESGO_OFF];

function first(value: string | string[] | undefined): string | undefined {
  const text = (Array.isArray(value) ? value[0] : value)?.trim();
  return text ? text : undefined;
}

export function parseCumplimientoFilters(params: SearchParams): CumplimientoFilters {
  const riesgo = first(params.riesgo);
  const page = Number(first(params.page));
  return {
    q: first(params.q), universidad: first(params.universidad), entidad: first(params.entidad),
    riesgo: riesgo && RIESGOS_VALIDOS.includes(riesgo) ? riesgo : RIESGO_DEFAULT,
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

export function cumplimientoHref(current: CumplimientoFilters, changes: Partial<CumplimientoFilters>): string {
  return buildHref(CUMPLIMIENTO_PATH, { ...current }, { ...changes }, { order: CUMPLIMIENTO_ORDER, defaults: CUMPLIMIENTO_DEFAULTS });
}

export function cumplimientoExportHref(filters: CumplimientoFilters): string {
  const query = toQuery({ ...filters } as Params, { order: EXPORT_ORDER });
  return query ? `${EXPORT_PATH}?${query}` : EXPORT_PATH;
}