export interface NavItem {
  id: string;
  label: string;
  /** Ruta de la sección; `null` si la pantalla todavía no existe. */
  href: string | null;
  /** Prefijos de ruta que marcan el ítem como activo (por defecto, `href`). */
  match?: string[];
  /** Se abre en otra pestaña (p. ej. el kiosko, que no tiene controles de admin para volver). */
  newTab?: boolean;
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
      { id: "kiosko", label: "Kiosko de marcación", href: "/marcacion", newTab: true },
      { id: "marcaciones", label: "Marcaciones de hoy", href: "/admin/marcaciones" },
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
    items: [
      { id: "reportes", label: "Reportes", href: "/admin/reportes", match: ["/admin/reportes"] },
    ],
  },
  {
    id: "configuracion",
    label: "CONFIGURACIÓN",
    items: [
      { id: "instituciones-sedes", label: "Instituciones y sedes", href: "/admin/instituciones-y-sedes" },
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
