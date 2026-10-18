import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { ProgressBar } from "@/components/admin/progress-bar";
import { ProgressRing } from "@/components/admin/progress-ring";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ringNote, RIESGO_OFF, RIESGO_OPCIONES } from "@/lib/reportes/cumplimiento";
import { formatDayLong, semester } from "@/lib/reportes/dates";
import {
  CUMPLIMIENTO_DEFAULTS, CUMPLIMIENTO_ORDER, CUMPLIMIENTO_PATH,
  cumplimientoExportHref, cumplimientoHref, parseCumplimientoFilters,
} from "@/lib/reportes/filters";
import { ASISTENCIA_PATH } from "@/lib/reportes/asistenciaFilters";
import { msToHours } from "@/lib/reportes/progress";
import type { ReporteRow } from "@/lib/reportes/rows";
import { getCumplimiento } from "@/lib/server/reporteService";
import { etiquetaOpcion } from "@/lib/catalogo/nombres";
import { listCatalogo } from "@/lib/server/catalogoService";
import { PAGE_SIZE } from "@/lib/server/usuarioService";
import { TIPO_OPCIONES } from "@/lib/usuarios/filters";
import { formatCedula } from "@/lib/usuarios/userInput";
import { FiltersBar } from "../filters-bar";
import { Pagination } from "../pagination";

export const metadata: Metadata = { title: "Cumplimiento de horas" };

const countFormat = new Intl.NumberFormat("es-CO");
const hoursFormat = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });
const hours = (ms: number) => hoursFormat.format(msToHours(ms));

export default async function CumplimientoPage({ searchParams }: PageProps<"/admin/reportes/cumplimiento">) {
  const now = new Date();
  const filters = parseCumplimientoFilters(await searchParams);

  const [{ total, enRiesgo, anillos, rows, page, pages, restoTotal }, catalogo] = await Promise.all([
    getCumplimiento(filters),
    listCatalogo(),
  ]);

  const from = restoTotal === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, restoTotal);
  const hasFilters = Boolean(filters.q || filters.tipo || filters.institucion || filters.sede);

  return (
    <>
      <header className="flex flex-col gap-5 bg-navy px-8 pt-6.5 pb-5 text-white">
        <div className="flex items-end justify-between gap-5">
          <div className="min-w-0">
            <h1 className="text-[27px] font-bold tracking-[-0.02em]">Cumplimiento de horas</h1>
            <p className="mt-1.5 text-sm text-white/65 tabular-nums">Semestre {semester(now)} · corte al {formatDayLong(now)}</p>
          </div>
          <div className="flex flex-none gap-2.5">
            <Link href={ASISTENCIA_PATH} className={buttonVariants({ variant: "outline" })}>Asistencia de hoy</Link>
            {total > 0 && <a href={cumplimientoExportHref(filters)} className={buttonVariants({ variant: "success" })}>Exportar a Excel</a>}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FiltersBar
            basePath={CUMPLIMIENTO_PATH} order={CUMPLIMIENTO_ORDER} params={{ ...filters }}
            defaults={CUMPLIMIENTO_DEFAULTS} tone="dark"
            defs={[
              { key: "tipo", label: "Tipo", options: TIPO_OPCIONES },
              { key: "institucion", label: "Institución", options: catalogo.instituciones.map((item) => ({ value: String(item.id), label: etiquetaOpcion(item) })) },
              { key: "sede", label: "Sede", options: catalogo.sedes.map((item) => ({ value: String(item.id), label: etiquetaOpcion(item) })) },
              { key: "riesgo", label: "Riesgo", options: RIESGO_OPCIONES, offValue: RIESGO_OFF },
            ]}
          />
          <p className="text-sm whitespace-nowrap text-white/65 tabular-nums">{countFormat.format(total)} practicantes cumplen el filtro</p>
        </div>
      </header>

      {total === 0 ? (
        <div className="flex flex-col items-center gap-3 px-8 py-20 text-center">
          <p className="text-[17px] font-semibold text-navy">{hasFilters ? "Ningún practicante coincide con estos filtros" : "Todavía no hay practicantes"}</p>
          <p className="max-w-[48ch] text-sm text-muted-foreground">{hasFilters ? "Prueba con otra búsqueda o quita algún filtro." : "Cuando haya practicantes con horas requeridas, aquí verás su cumplimiento."}</p>
          {hasFilters && <Link href={CUMPLIMIENTO_PATH} className={buttonVariants({ variant: "outline" })}>Quitar filtros</Link>}
        </div>
      ) : (
        <>
          {anillos.length > 0 && (
            <section aria-label="En riesgo" className="grid grid-cols-4 gap-4 px-8 pt-6 pb-2">
              {anillos.map((row) => <RingCard key={row.id} row={row} now={now} />)}
            </section>
          )}
          {enRiesgo > anillos.length && (
            <p className="px-8 pb-4 text-sm text-muted-foreground">
              Mostrando los {anillos.length} con menor avance de {countFormat.format(enRiesgo)} en riesgo; el resto aparece en la tabla de abajo.
            </p>
          )}
          {rows.length > 0 && (
            <div className="mx-8 mb-8 overflow-hidden rounded-xl border border-border bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead><TableHead>Cédula</TableHead>
                    <TableHead>Institución</TableHead><TableHead>Sede</TableHead>
                    <TableHead>Progreso</TableHead><TableHead className="text-right">Cumplidas</TableHead>
                    <TableHead className="text-right">Restantes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>{rows.map((row) => <CumplimientoTableRow key={row.id} row={row} />)}</TableBody>
              </Table>
              <Pagination page={page} pages={pages} from={from} to={to} total={restoTotal} hrefFor={(n) => cumplimientoHref(filters, { page: n })} />
            </div>
          )}
        </>
      )}
    </>
  );
}

function RingCard({ row, now }: { row: ReporteRow; now: Date }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-white px-5 py-4">
      <ProgressRing percent={row.percent ?? 0} label={`Avance de ${row.nombre}`} />
      <div className="flex min-w-0 flex-col gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-navy">{row.nombre}</p>
          <p className="truncate text-[13px] text-muted-foreground">{row.sede ?? row.institucion ?? "Sin afiliación"}</p>
        </div>
        <div className="flex items-baseline gap-2 text-[13px] tabular-nums">
          <span className="text-navy">{hours(row.workedMs)} h cumplidas</span>
          {row.remainingMs !== null && <span className="font-semibold text-brand-amber-ink">{hours(row.remainingMs)} h restantes</span>}
        </div>
        <p className="text-[12.5px] text-muted-foreground">{ringNote(row, now)}</p>
      </div>
    </div>
  );
}

function CumplimientoTableRow({ row }: { row: ReporteRow }) {
  return (
    <TableRow>
      <TableCell className="font-semibold text-navy">{row.nombre}</TableCell>
      <TableCell className="tabular-nums">{formatCedula(row.cedula)}</TableCell>
      <TableCell>{row.institucion ?? "—"}</TableCell>
      <TableCell>{row.sede ?? "—"}</TableCell>
      <TableCell className="min-w-40">
        {row.percent === null ? <span className="text-muted-foreground">Sin meta</span> : (
          <div className="flex items-center gap-2.5">
            <ProgressBar percent={row.percent} label={`Avance de ${row.nombre}`} className="w-24" />
            <span className="text-[13px] font-semibold text-navy tabular-nums">{row.percent}%</span>
          </div>
        )}
      </TableCell>
      <TableCell className="text-right font-semibold text-navy tabular-nums">{hours(row.workedMs)} h</TableCell>
      <TableCell className="text-right tabular-nums">{row.remainingMs === null ? <span className="text-muted-foreground">—</span> : `${hours(row.remainingMs)} h`}</TableCell>
    </TableRow>
  );
}