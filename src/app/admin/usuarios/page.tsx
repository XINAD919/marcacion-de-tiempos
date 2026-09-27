import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { initials } from "@/lib/initials";
import { PAGE_SIZE, type UsuarioRow, listFilterOptions, listUsuarios } from "@/lib/server/usuarioService";
import { ESTADO_OPCIONES, type Filters, hrefWith, parseUsuarioFilters } from "@/lib/usuarios/filters";
import { formatCedula } from "@/lib/usuarios/userInput";
import { cn } from "@/lib/utils";
import { FiltersBar } from "./filters-bar";

export const metadata: Metadata = { title: "Usuarios" };

const numberFormat = new Intl.NumberFormat("es-CO");

function EstadoPill({ user }: { user: UsuarioRow }) {
  if (!user.activo) return <Badge variant="inactivo">Inactivo</Badge>;
  if (user.fotos === 0) return <Badge variant="sin-rostro">Sin rostro</Badge>;
  return <Badge variant="activo">Activo</Badge>;
}

export default async function UsuariosPage({ searchParams }: PageProps<"/admin/usuarios">) {
  const filters = parseUsuarioFilters(await searchParams);
  const [{ rows, total, page, counts }, options] = await Promise.all([
    listUsuarios(filters),
    listFilterOptions(),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  const hasFilters = Boolean(filters.q || filters.universidad || filters.entidad || filters.estado);

  return (
    <>
      <PageHeader
        title="Usuarios"
        description={`${numberFormat.format(counts.registrados)} registrados · ${numberFormat.format(counts.activos)} activos · ${numberFormat.format(counts.inactivos)} inactivos`}
        actions={
          <>
            <Link href="/admin/usuarios/importar" className={buttonVariants({ variant: "outline" })}>
              Importar desde Excel
            </Link>
            <Link href="/admin/usuarios/nuevo" className={buttonVariants()}>
              + Crear usuario
            </Link>
          </>
        }
      >
        <FiltersBar
          filters={filters}
          defs={[
            {
              key: "universidad",
              label: "Universidad / Colegio",
              options: options.universidades.map((value) => ({ value, label: value })),
            },
            {
              key: "entidad",
              label: "Entidad",
              options: options.entidades.map((value) => ({ value, label: value })),
            },
            { key: "estado", label: "Estado", options: [...ESTADO_OPCIONES] },
          ]}
        />
      </PageHeader>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-8 py-20 text-center">
          <p className="text-[17px] font-semibold text-navy">
            {hasFilters ? "Ningún usuario coincide con estos filtros" : "Todavía no hay usuarios"}
          </p>
          <p className="max-w-[48ch] text-sm text-muted-foreground">
            {hasFilters
              ? "Prueba con otra búsqueda o quita algún filtro."
              : "Crea el primero o importa el Excel que usaba la fundación."}
          </p>
          {hasFilters && (
            <Link href="/admin/usuarios" className={buttonVariants({ variant: "outline" })}>
              Quitar filtros
            </Link>
          )}
        </div>
      ) : (
        <div className="flex flex-col bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Cédula</TableHead>
                <TableHead>Universidad / Colegio</TableHead>
                <TableHead>Entidad</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((user) => {
                const needsFace = user.activo && user.fotos === 0;
                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span
                          aria-hidden
                          className="flex size-8 flex-none items-center justify-center rounded-full bg-bone-2 text-xs font-semibold text-navy"
                        >
                          {initials(user.nombre)}
                        </span>
                        <span className="font-semibold">{user.nombre}</span>
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums">{formatCedula(user.cedula)}</TableCell>
                    <TableCell>{user.universidad}</TableCell>
                    <TableCell>{user.entidad}</TableCell>
                    <TableCell>
                      <EstadoPill user={user} />
                    </TableCell>
                    <TableCell className="text-right">
                      {/* Una sola acción por fila; cambia según el estado (maqueta 2a). */}
                      <Link
                        href={needsFace ? `/admin/enrolar/${user.id}` : `/admin/usuarios/${user.id}/editar`}
                        className="font-semibold text-brand-red-ink hover:underline"
                      >
                        {needsFace ? "Enrolar" : "Editar"}
                        <span className="sr-only"> a {user.nombre}</span>
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <Pagination filters={filters} page={page} pages={pages} from={from} to={to} total={total} />
        </div>
      )}
    </>
  );
}

function Pagination({
  filters,
  page,
  pages,
  from,
  to,
  total,
}: {
  filters: Filters;
  page: number;
  pages: number;
  from: number;
  to: number;
  total: number;
}) {
  // Ventana de hasta 5 páginas alrededor de la actual.
  const start = Math.max(1, Math.min(page - 2, pages - 4));
  const numbers = Array.from({ length: Math.min(5, pages) }, (_, i) => start + i);
  const linkClass = "flex size-9 items-center justify-center rounded-lg text-sm font-semibold tabular-nums";

  return (
    <nav
      aria-label="Paginación"
      className="flex items-center justify-between border-t border-border px-8 py-4 text-sm text-muted-foreground"
    >
      <p className="tabular-nums">
        Mostrando {numberFormat.format(from)}–{numberFormat.format(to)} de {numberFormat.format(total)}
      </p>
      <div className="flex items-center gap-1">
        {page > 1 && (
          <Link href={hrefWith(filters, { page: page - 1 })} aria-label="Página anterior" className={cn(linkClass, "text-navy hover:bg-bone-2")}>
            ‹
          </Link>
        )}
        {numbers.map((n) => (
          <Link
            key={n}
            href={hrefWith(filters, { page: n })}
            aria-current={n === page ? "page" : undefined}
            className={cn(linkClass, n === page ? "bg-navy text-white" : "text-navy hover:bg-bone-2")}
          >
            {n}
          </Link>
        ))}
        {page < pages && (
          <Link href={hrefWith(filters, { page: page + 1 })} aria-label="Página siguiente" className={cn(linkClass, "text-navy hover:bg-bone-2")}>
            ›
          </Link>
        )}
      </div>
    </nav>
  );
}
