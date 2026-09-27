export interface NavItem {
  id: string;
  label: string;
  /** Ruta de la sección; `null` si la pantalla todavía no existe. */
  href: string | null;
  /** Prefijos de ruta que marcan el ítem como activo (por defecto, `href`). */
  match?: string[];
}

export interface NavSection {
  id: string;
  label: string;
  items: NavItem[];
}

// Estructura de las maquetas 2a y 4g. Las secciones sin pantalla se muestran
// deshabilitadas para que la coordinadora vea qué viene, sin llevarla a un 404.
export const NAV_SECTIONS: NavSection[] = [
  {
    id: "operacion",
    label: "OPERACIÓN",
    items: [
      { id: "marcaciones", label: "Marcaciones de hoy", href: null },
      { id: "usuarios", label: "Usuarios", href: "/admin/usuarios" },
      {
        id: "enrolamiento",
        label: "Enrolamiento facial",
        // Lleva al listado filtrado por quienes aún no tienen rostro.
        href: "/admin/usuarios?estado=sin-rostro",
        match: ["/admin/enrolar"],
      },
    ],
  },
  {
    id: "analisis",
    label: "ANÁLISIS",
    items: [{ id: "reportes", label: "Reportes", href: null }],
  },
  {
    id: "configuracion",
    label: "CONFIGURACIÓN",
    items: [
      { id: "entidades-sedes", label: "Entidades y sedes", href: null },
      {
        id: "configuracion",
        label: "Configuración",
        href: "/admin/configuracion",
        match: ["/admin/configuracion", "/admin/administradores"],
      },
    ],
  },
];

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  const prefixes = item.match ?? (item.href ? [item.href] : []);
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
