export const ESTADO_OPCIONES = [
  { value: "activo", label: "Activo" },
  { value: "inactivo", label: "Inactivo" },
  { value: "sin-rostro", label: "Sin rostro" },
] as const;

export type Estado = (typeof ESTADO_OPCIONES)[number]["value"];

export interface Filters {
  q?: string;
  universidad?: string;
  entidad?: string;
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

export function parseUsuarioFilters(params: SearchParams): Filters {
  const estado = first(params.estado);
  const page = Number(first(params.page));
  return {
    q: first(params.q),
    universidad: first(params.universidad),
    entidad: first(params.entidad),
    estado: isEstado(estado) ? estado : undefined,
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

const ORDER: (keyof Filters)[] = ["q", "universidad", "entidad", "estado", "page"];

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
