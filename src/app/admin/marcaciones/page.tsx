import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { etiquetaOpcion } from "@/lib/catalogo/nombres";
import { NOVEDAD_LABEL, type Novedad } from "@/lib/marcaciones/novedades";
import { type Params, buildHref } from "@/lib/reportes/href";
import { formatDayLong, formatDayShort, formatTime } from "@/lib/reportes/dates";
import { listCatalogo } from "@/lib/server/catalogoService";
import { type Pendiente, type Scope, getMarcacionesDelDia, listPendientes } from "@/lib/server/marcacionesQuery";
import { cn } from "@/lib/utils";
import { AutoRefresh } from "../reportes/auto-refresh";
import { RegistrarEntradaDialog, RegistrarSalidaDialog } from "../_correcciones/dialogs";
import { FiltrosMarcaciones } from "./filtros";
import { MARCACIONES_ORDER, MARCACIONES_PATH } from "./params";

export const metadata: Metadata = { title: "Marcaciones de hoy" };

const PENDIENTES_RESUMEN = 10;
const PENDIENTES_POR_PAGINA = 20;
const countFormat = new Intl.NumberFormat("es-CO");
const METODO: Record<string, string> = { face: "Rostro", qr: "QR", manual: "Manual" };

type SP = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const positivo = (value: string | undefined) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : undefined;
};

function Pildora({ novedad }: { novedad: Novedad }) {
  const ambar = novedad.tipo === "tarde" || novedad.tipo === "salida-temprana";
  return (
    <Badge variant={ambar ? "sin-rostro" : "inactivo"}>
      {novedad.tipo === "tarde" ? `${novedad.minutos} min tarde` : NOVEDAD_LABEL[novedad.tipo]}
    </Badge>
  );
}

export default async function MarcacionesPage({ searchParams }: PageProps<"/admin/marcaciones">) {
  const sp: SP = await searchParams;
  const now = new Date();
  const sede = positivo(first(sp.sede));
  const institucion = positivo(first(sp.institucion));
  const soloNovedades = first(sp.vista) === "novedades";
  const todas = first(sp.pendientes) === "todas";
  const scope: Scope = { sede, institucion };

  const [{ rows, resumen }, catalogo] = await Promise.all([getMarcacionesDelDia(scope, now), listCatalogo()]);

  const pagina = todas
    ? Math.min(positivo(first(sp.page)) ?? 1, Math.max(1, Math.ceil(resumen.pendientes / PENDIENTES_POR_PAGINA)))
    : 1;
  const { rows: pendientes, total } = await listPendientes(
    scope,
    todas
      ? { limit: PENDIENTES_POR_PAGINA, offset: (pagina - 1) * PENDIENTES_POR_PAGINA }
      : { limit: PENDIENTES_RESUMEN, offset: 0 },
    now,
  );
  const paginas = Math.max(1, Math.ceil(total / PENDIENTES_POR_PAGINA));

  const params: Params = {
    sede, institucion,
    vista: soloNovedades ? "novedades" : undefined,
    pendientes: todas ? "todas" : undefined,
    page: pagina,
  };
  const hrefWith = (changes: Params) => buildHref(MARCACIONES_PATH, params, changes, { order: MARCACIONES_ORDER });

  const visibles = soloNovedades ? rows.filter((r) => r.marca.novedades.length > 0) : rows;
  const cifras = [
    { label: "Dentro ahora", value: resumen.dentroAhora, tone: "text-navy" },
    { label: "Ya salieron", value: resumen.yaSalieron, tone: "text-brand-green-ink" },
    { label: "Llegaron tarde", value: resumen.tarde, tone: "text-brand-amber-ink" },
    { label: "Salidas tempranas", value: resumen.salidasTempranas, tone: "text-brand-amber-ink" },
    { label: "Salidas sin marcar", value: resumen.pendientes, tone: "text-brand-red-ink", pendiente: true },
  ];

  return (
    <>
      <PageHeader title="Marcaciones de hoy" description={`${formatDayLong(now)} · actualizado ${formatTime(now)}`}>
        <FiltrosMarcaciones
          params={{ sede, institucion }}
          defs={[
            { key: "sede", label: "Sede", options: catalogo.sedes.map((s) => ({ value: String(s.id), label: etiquetaOpcion(s) })) },
            { key: "institucion", label: "Institución", options: catalogo.instituciones.map((i) => ({ value: String(i.id), label: etiquetaOpcion(i) })) },
          ]}
        />
      </PageHeader>

      <AutoRefresh seconds={60} />

      <div className="flex flex-col gap-6 px-8 py-6">
        <section aria-label="Resumen" className="grid grid-cols-[repeat(5,minmax(0,1fr))] gap-4">
          {cifras.map((c) => (
            <div
              key={c.label}
              className={cn(
                "flex min-w-0 flex-col gap-2.5 rounded-xl border border-border bg-white px-5 py-4",
                c.pendiente && "border-l-4 border-l-brand-red",
              )}
            >
              <span className="text-[11.5px] font-semibold tracking-[0.09em] text-navy/62 uppercase">{c.label}</span>
              <span className={cn("text-[38px] leading-none font-extrabold tabular-nums", c.tone)}>
                {countFormat.format(c.value)}
              </span>
            </div>
          ))}
        </section>

        <section aria-labelledby="sin-marcar" className="overflow-hidden rounded-xl border border-border bg-white">
          <div className="flex flex-col gap-1 px-6 pt-4 pb-3">
            <h2 id="sin-marcar" className="text-lg font-bold tracking-[-0.02em] text-navy">
              Salidas sin marcar <span className="tabular-nums">({countFormat.format(total)})</span>
            </h2>
            <p className="text-sm text-muted-foreground">Entradas de días anteriores sin salida. No suman horas hasta corregirlas</p>
          </div>
          {pendientes.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">No hay salidas sin marcar.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Practicante</TableHead>
                  <TableHead>Día</TableHead>
                  <TableHead>Marcación</TableHead>
                  <TableHead>Horario</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendientes.map((p) => (
                  <FilaPendiente key={p.inconsistencia.marca.id} pendiente={p} />
                ))}
              </TableBody>
            </Table>
          )}
          {(total > PENDIENTES_RESUMEN || todas) && (
            <div className="flex items-center justify-between gap-4 border-t border-border px-6 py-3 text-sm text-muted-foreground">
              {todas ? (
                <>
                  <p className="tabular-nums">Página {pagina} de {paginas}</p>
                  <div className="flex gap-2">
                    {pagina > 1 && <Link href={hrefWith({ page: pagina - 1 })} className={buttonVariants({ variant: "outline" })}>Anteriores</Link>}
                    {pagina < paginas && <Link href={hrefWith({ page: pagina + 1 })} className={buttonVariants({ variant: "outline" })}>Siguientes</Link>}
                    <Link href={hrefWith({ pendientes: undefined })} className={buttonVariants({ variant: "outline" })}>Ver menos</Link>
                  </div>
                </>
              ) : (
                <>
                  <p className="tabular-nums">Mostrando {PENDIENTES_RESUMEN} de {countFormat.format(total)}</p>
                  <Link href={hrefWith({ pendientes: "todas" })} className="font-semibold text-brand-red-ink hover:underline">
                    Ver todas
                  </Link>
                </>
              )}
            </div>
          )}
        </section>

        <section aria-labelledby="del-dia" className="overflow-hidden rounded-xl border border-border bg-white">
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 pt-4 pb-3">
            <h2 id="del-dia" className="text-lg font-bold tracking-[-0.02em] text-navy">
              Marcaciones de hoy <span className="tabular-nums">({countFormat.format(visibles.length)})</span>
            </h2>
            <div role="group" aria-label="Qué marcaciones mostrar" className="flex gap-2">
              {[
                { label: "Todas", activo: !soloNovedades, href: hrefWith({ vista: undefined }) },
                { label: "Solo novedades", activo: soloNovedades, href: hrefWith({ vista: "novedades" }) },
              ].map((o) => (
                <Link
                  key={o.label}
                  href={o.href}
                  aria-current={o.activo ? "true" : undefined}
                  className={cn(
                    "flex h-10.5 items-center rounded-lg border-[1.5px] px-3.5 text-sm font-semibold text-navy hover:bg-bone-2",
                    o.activo ? "border-navy bg-white" : "border-navy/25 bg-white font-medium",
                  )}
                >
                  {o.label}
                </Link>
              ))}
            </div>
          </div>
          {visibles.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              {soloNovedades ? "Hoy no hay marcaciones con novedades." : "Todavía no hay marcaciones hoy."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hora</TableHead>
                  <TableHead>Practicante</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Novedad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibles.map(({ marca, user }) => (
                  <TableRow key={marca.id}>
                    <TableCell className="font-semibold text-navy tabular-nums">{formatTime(marca.marcadoEn)}</TableCell>
                    <TableCell>
                      <Link href={`/admin/usuarios/${user.id}`} className="font-medium text-navy hover:underline">
                        {user.nombre}
                      </Link>
                    </TableCell>
                    <TableCell className="text-[11.5px] font-semibold tracking-[0.08em] uppercase">
                      {marca.tipo === "IN" ? "Entrada" : "Salida"}
                    </TableCell>
                    <TableCell>{METODO[marca.metodo] ?? marca.metodo}</TableCell>
                    <TableCell>
                      {marca.novedades.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {marca.novedades.map((n) => (
                            <Pildora key={n.tipo} novedad={n} />
                          ))}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      </div>
    </>
  );
}

function FilaPendiente({ pendiente }: { pendiente: Pendiente }) {
  const { inconsistencia: inc, user, horaSugerida } = pendiente;
  const hora = formatTime(inc.marca.marcadoEn);
  const horario = user.horaInicio && user.horaFin ? `${user.horaInicio}–${user.horaFin}` : "—";
  return (
    <TableRow>
      <TableCell>
        <Link href={`/admin/usuarios/${user.id}`} className="font-medium text-navy hover:underline">
          {user.nombre}
        </Link>
      </TableCell>
      <TableCell className="tabular-nums">{formatDayShort(inc.marca.marcadoEn)}</TableCell>
      <TableCell className="tabular-nums">
        {inc.tipo === "sin-salida" ? "Entrada" : "Salida sin entrada"} {hora}
      </TableCell>
      <TableCell className="tabular-nums">{horario}</TableCell>
      <TableCell className="text-right">
        {inc.tipo === "sin-salida" ? (
          <RegistrarSalidaDialog
            entradaId={inc.marca.id}
            entradaHora={hora}
            sugerida={horaSugerida}
            temprana={false}
            trigger="Registrar salida"
          />
        ) : (
          <RegistrarEntradaDialog salidaId={inc.marca.id} salidaHora={hora} trigger="Registrar entrada" />
        )}
      </TableCell>
    </TableRow>
  );
}
