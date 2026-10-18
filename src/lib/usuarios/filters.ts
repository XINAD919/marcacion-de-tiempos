import { TIPOS_INSTITUCION, TIPO_INSTITUCION_LABEL, type TipoInstitucion } from "@/lib/catalogo/institucion";

export const ESTADO_OPCIONES = [
  { value: "activo", label: "Activo" },
  { value: "inactivo", label: "Inactivo" },
  { value: "sin-rostro", label: "Sin rostro" },
] as const;

export type Estado = (typeof ESTADO_OPCIONES)[number]["value"];

/** Universidad / Técnica / Colegio salen de la institución; natural, del usuario. */
export type TipoFiltro = TipoInstitucion | "natural";

export const TIPO_OPCIONES: { value: TipoFiltro; label: string }[] = [
  ...TIPOS_INSTITUCION.map((value) => ({ value, label: TIPO_INSTITUCION_LABEL[value] })),
  { value: "natural", label: "Voluntario natural" },
];

export interface Filters {
  q?: string;
  tipo?: TipoFiltro;
  /** IDs del catálogo (maqueta 4f). */
  institucion?: number;
  sede?: number;
  estado?: Estado;
  page?: number;
}

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  const text = (Array.isArray(value) ? value[0] : value)?.trim();
  return text ? text : undefined;
}

function isEstado(value: string | undefined): value is Estado {
  return ESTADO_OPCIONES.some((option) => option.value === value);
}

function isTipoFiltro(value: string | undefined): value is TipoFiltro {
  return TIPO_OPCIONES.some((option) => option.value === value);
}

function positiveInt(value: string | undefined): number | undefined {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
}

export function parseUsuarioFilters(params: SearchParams): Filters {
  const tipo = first(params.tipo);
  const estado = first(params.estado);
  return {
    q: first(params.q),
    tipo: isTipoFiltro(tipo) ? tipo : undefined,
    institucion: positiveInt(first(params.institucion)),
    sede: positiveInt(first(params.sede)),
    estado: isEstado(estado) ? estado : undefined,
    page: positiveInt(first(params.page)) ?? 1,
  };
}

const ORDER: (keyof Filters)[] = ["q", "tipo", "institucion", "sede", "estado", "page"];

/**
 * URL del listado con `changes` aplicados. Cualquier cambio que no sea de
 * página vuelve a la página 1, para no quedar en una página que ya no existe.
 */
export function hrefWith(current: Filters, changes: Partial<Filters>): string {
  const next: Filters = { ...current, ...changes };
  if (!("page" in changes)) next.page = undefined;

  const params = new URLSearchParams();
  for (const key of ORDER) {
    const value = next[key];
    if (value === undefined || value === "" || (key === "page" && value === 1)) continue;
    params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `/admin/usuarios?${query}` : "/admin/usuarios";
}
