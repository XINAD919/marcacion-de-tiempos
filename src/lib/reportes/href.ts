export type Params = Record<string, string | number | undefined>;

export interface HrefOptions {
  order: readonly string[];
  defaults?: Record<string, string>;
}

export function toQuery(params: Params, { order, defaults = {} }: HrefOptions): string {
  const query = new URLSearchParams();
  for (const key of order) {
    const value = params[key];
    if (value === undefined || value === "") continue;
    if (key === "page" && Number(value) === 1) continue;
    if (defaults[key] !== undefined && String(value) === defaults[key]) continue;
    query.set(key, String(value));
  }
  return query.toString();
}

export function buildHref(basePath: string, current: Params, changes: Params, options: HrefOptions): string {
  const next: Params = { ...current, ...changes };
  if (!("page" in changes)) next.page = undefined;
  const query = toQuery(next, options);
  return query ? `${basePath}?${query}` : basePath;
}