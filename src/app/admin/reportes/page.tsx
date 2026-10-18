import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { ProgressBar } from "@/components/admin/progress-bar";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AsistenciaRow, EstadoAsistencia } from "@/lib/reportes/attendance";
import {
  ASISTENCIA_ORDER, ASISTENCIA_PATH, asistenciaExportHref, asistenciaHref,
  estadoAsistenciaOpciones, fechaOpciones, parseAsistenciaFilters, resolveDay,
} from "@/lib/reportes/asistenciaFilters";
import { formatDayLong, formatTime, isSameDay } from "@/lib/reportes/dates";
import { CUMPLIMIENTO_PATH } from "@/lib/reportes/filters";
import { msToHours } from "@/lib/reportes/progress";
import { getAsistencia } from "@/lib/server/reporteService";
import { etiquetaOpcion } from "@/lib/catalogo/nombres";
import { listCatalogo } from "@/lib/server/catalogoService";
import { PAGE_SIZE } from "@/lib/server/usuarioService";
import { TIPO_OPCIONES } from "@/lib/usuarios/filters";
import { formatCedula } from "@/lib/usuarios/userInput";
import { cn } from "@/lib/utils";
import { AutoRefresh } from "./auto-refresh";
import { FiltersBar } from "./filters-bar";
import { Pagination } from "./pagination";

export const metadata: Metadata = { title: "Asistencia de hoy" };

const countFormat = new Intl.NumberFormat("es-CO");
const hoursFormat = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });
const hours = (ms: number) => hoursFormat.format(msToHours(ms));

const TONE = { navy: "text-navy", green: "text-brand-green-ink", amber: "text-brand-amber-ink", red: "text-brand-red-ink" } as const;

export default async function AsistenciaPage({ searchParams }: PageProps<"/admin/reportes">) {
  const now = new Date();
  const filters = parseAsistenciaFilters(await searchParams, now);
  const day = resolveDay(filters, now);
  const esHoy = isSameDay(day, now);

  const [{ summary, rows, total, page, pages }, catalogo] = await Promise.all([
    getAsistencia(filters, now),
    listCatalogo(),
  ]);

  const estados = estadoAsistenciaOpciones(esHoy);
  const cards: { estado: EstadoAsistencia; value: number; tone: keyof typeof TONE }[] = [
    { estado: "presente", value: summary.presentes, tone: "navy" },
    { estado: "marcaron", value: summary.marcaron, tone: "green" },
    { estado: "tarde", value: summary.tarde, tone: "amber" },
    { estado: "sin-marcar", value: summary.sinMarcar, tone: "red" },
  ];

  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  const hasFilters = Boolean(filters.q || filters.tipo || filters.institucion || filters.sede || filters.estado);
  const sedeFiltrada = catalogo.sedes.find((item) => item.id === filters.sede)?.nombre;

  return (
    <>
      <PageHeader
        title={esHoy ? "Asistencia de hoy" : "Asistencia del día"}
        description={`${formatDayLong(day)}${esHoy ? ` · actualizado ${formatTime(now)}` : ""}`}
        actions={
          <>
            <Link href={CUMPLIMIENTO_PATH} className={buttonVariants({ variant: "outline" })}>Cumplimiento de horas</Link>
            {total > 0 && (
              <a href={asistenciaExportHref(filters)} className={buttonVariants({ variant: "success" })}>Exportar a Excel</a>
            )}
          </>
        }
      >
        <FiltersBar
          basePath={ASISTENCIA_PATH} order={ASISTENCIA_ORDER} params={{ ...filters }}
          defs={[
            { key: "fecha", label: "Hoy", options: fechaOpciones(now) },
            { key: "tipo", label: "Tipo", options: TIPO_OPCIONES },
            { key: "institucion", label: "Institución", options: catalogo.instituciones.map((item) => ({ value: String(item.id), label: etiquetaOpcion(item) })) },
            { key: "sede", label: "Sede", options: catalogo.sedes.map((item) => ({ value: String(item.id), label: etiquetaOpcion(item) })) },
            { key: "estado", label: "Estado", options: estados },
          ]}
        />
      </PageHeader>

      {esHoy && <AutoRefresh />}

      <section aria-label="Resumen" className="grid grid-cols-4 gap-4 px-8 pt-6 pb-6">
        {cards.map(({ estado, value, tone }) => {
          const active = filters.estado === estado;
          return (
            <Link key={estado} href={asistenciaHref(filters, { estado: active ? undefined : estado })}
              aria-current={active ? "true" : undefined}
              className={cn("flex flex-col gap-2.5 rounded-xl border-[1.5px] bg-white px-5 py-4 outline-none hover:bg-bone-2 focus-visible:ring-3 focus-visible:ring-navy/15", active ? "border-navy" : "border-border")}>
              <span className="text-[11.5px] font-semibold tracking-[0.09em] text-navy/62 uppercase">
                {estados.find((option) => option.value === estado)?.label}
              </span>
              <span className={cn("text-[38px] leading-none font-extrabold tabular-nums", TONE[tone])}>
                {countFormat.format(value)}
              </span>
            </Link>
          );
        })}
      </section>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-8 py-20 text-center">
          <p className="text-[17px] font-semibold text-navy">
            {hasFilters ? "Ningún practicante coincide con estos filtros" : "Nadie tiene asistencia para este día"}
          </p>
          <p className="max-w-[48ch] text-sm text-muted-foreground">
            {hasFilters ? "Prueba con otra búsqueda o quita algún filtro." : "Aparecerán aquí los practicantes que marquen entrada y los que debían hacerlo."}
          </p>
          {hasFilters && <Link href={ASISTENCIA_PATH} className={buttonVariants({ variant: "outline" })}>Quitar filtros</Link>}
        </div>
      ) : (
        <div className="mx-8 mb-8 overflow-hidden rounded-xl border border-border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead><TableHead>Cédula</TableHead>
                <TableHead>Institución</TableHead><TableHead>Sede</TableHead>
                <TableHead className="text-right">Entrada</TableHead><TableHead className="text-right">Salida</TableHead>
                <TableHead>Progreso de horas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>{rows.map((row) => <AsistenciaTableRow key={row.id} row={row} />)}</TableBody>
          </Table>
          <Pagination page={page} pages={pages} from={from} to={to} total={total}
            suffix={sedeFiltrada ? ` en ${sedeFiltrada}` : ""}
            hrefFor={(n) => asistenciaHref(filters, { page: n })}
            extra={summary.sinMarcar > 0 && filters.estado !== "sin-marcar" && (
              <Link href={asistenciaHref(filters, { estado: "sin-marcar" })} className="font-semibold text-brand-red-ink hover:underline">
                Ver los {countFormat.format(summary.sinMarcar)} sin marcar
              </Link>
            )}
          />
        </div>
      )}
    </>
  );
}

function AsistenciaTableRow({ row }: { row: AsistenciaRow }) {
  return (
    <TableRow>
      <TableCell>{row.nombre}</TableCell>
      <TableCell className="tabular-nums">{formatCedula(row.cedula)}</TableCell>
      <TableCell>{row.institucion ?? "—"}</TableCell>
      <TableCell>{row.sede ?? "—"}</TableCell>
      <TableCell className="text-right"><Entrada row={row} /></TableCell>
      <TableCell className="text-right tabular-nums">
        {row.salida ? <span className="font-semibold text-navy">{formatTime(row.salida)}</span> : <span className="text-muted-foreground">—</span>}
      </TableCell>
      <TableCell className="min-w-64">
        {row.percent === null ? <span className="text-muted-foreground">Sin horas definidas</span> : (
          <div className="flex items-center gap-3">
            <ProgressBar percent={row.percent} label={`Avance de ${row.nombre}`} className="w-36" />
            <span className="w-20 text-right text-[13px] font-semibold text-navy tabular-nums">
              {hours(row.workedMs)} / {countFormat.format(row.horasRequeridas)}
            </span>
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}

function Entrada({ row }: { row: AsistenciaRow }) {
  if (!row.entrada) return <span className="font-semibold text-brand-red-ink">Sin marcar</span>;
  const tarde = row.minutosTarde !== null;
  return (
    <span className={cn("font-semibold tabular-nums", tarde ? "text-brand-amber-ink" : "text-brand-green-ink")} title={tarde ? `Llegó ${row.minutosTarde} min tarde` : undefined}>
      {formatTime(row.entrada)}
      {tarde && <span className="sr-only"> (llegó {row.minutosTarde} min tarde)</span>}
    </span>
  );
}