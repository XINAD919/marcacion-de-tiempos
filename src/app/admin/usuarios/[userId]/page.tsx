import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { ProgressBar } from "@/components/admin/progress-bar";
import { ProgressRing } from "@/components/admin/progress-ring";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { horaSugerida } from "@/lib/marcaciones/correcciones";
import type { Novedad } from "@/lib/marcaciones/novedades";
import { formatDayShort, formatTime, toDayParam } from "@/lib/reportes/dates";
import { msToHours } from "@/lib/reportes/progress";
import { type DiaHistorial, type MarcaHistorial, getPerfil } from "@/lib/server/marcacionesQuery";
import { formatCedula } from "@/lib/usuarios/userInput";
import { RegistrarEntradaDialog, RegistrarSalidaDialog } from "../../_correcciones/dialogs";
import { type DiaVista, type MarcaVista, Historial } from "./historial";

export const metadata: Metadata = { title: "Perfil del practicante" };

const numberFormat = new Intl.NumberFormat("es-CO");
const horas = (ms: number) => `${numberFormat.format(msToHours(ms))} h`;

function notaDe(novedad: Novedad, marca: MarcaHistorial): { texto: string; ambar: boolean } | null {
  switch (novedad.tipo) {
    case "tarde":
      return { texto: `${novedad.minutos} min tarde`, ambar: true };
    case "salida-temprana": {
      if (marca.metodo !== "manual") return { texto: "Salida temprana", ambar: true };
      const motivo = marca.motivo ?? "sin motivo";
      return {
        texto: `Salida temprana: ${motivo}${marca.registradoPor ? ` · registró ${marca.registradoPor}` : ""}`,
        ambar: true,
      };
    }
    case "manual": {
      const motivo = marca.motivo ? `: ${marca.motivo}` : "";
      return { texto: `Manual${motivo}${marca.registradoPor ? ` · registró ${marca.registradoPor}` : ""}`, ambar: false };
    }
    case "qr":
      return null; // el método ya dice QR
  }
}

function armarDia(dia: DiaHistorial): DiaVista {
  const validas = dia.marcas.filter((m) => !m.anuladaEn);
  const marcas: MarcaVista[] = dia.marcas.map((m) => {
    const i = validas.indexOf(m);
    const siguiente = i >= 0 ? validas[i + 1] : undefined;
    const anterior = i > 0 ? validas[i - 1] : undefined;
    const tipo = m.tipo === "IN" ? "IN" : "OUT";
    const sinPareja =
      i < 0 ? null : tipo === "IN" ? (siguiente?.tipo === "OUT" ? null : "Sin salida") : anterior?.tipo === "IN" ? null : "Sin entrada";
    return {
      id: m.id,
      tipo,
      hora: formatTime(m.marcadoEn),
      metodo: m.metodo,
      notas: m.novedades.map((n) => notaDe(n, m)).filter((n): n is { texto: string; ambar: boolean } => n !== null),
      corregida: m.reemplazaAId !== null,
      sinPareja,
      anulada: m.anuladaEn ? { motivo: m.motivoAnulacion, por: m.anuladaPor } : null,
      pareja: tipo === "IN" && siguiente?.tipo === "OUT" ? { hora: formatTime(siguiente.marcadoEn) } : null,
      descripcion: `${tipo === "IN" ? "Entrada" : "Salida"} de las ${formatTime(m.marcadoEn)} del ${formatDayShort(dia.dia)}`,
    };
  });
  return { clave: toDayParam(dia.dia), etiqueta: formatDayShort(dia.dia), jornada: horas(dia.jornadaMs), marcas };
}

export default async function PerfilPage({ params, searchParams }: PageProps<"/admin/usuarios/[userId]">) {
  const { userId } = await params;
  const { page: pageParam } = await searchParams;
  const page = Number(Array.isArray(pageParam) ? pageParam[0] : pageParam) || 1;
  const perfil = await getPerfil(userId, page);
  if (!perfil) notFound();

  const { user, avance, jornadaAbierta, inconsistencias, sugerencia, dias } = perfil;
  const natural = user.tipo === "natural";
  const horario = user.horaInicio && user.horaFin ? `${user.horaInicio}–${user.horaFin}` : null;
  const descripcion = [`C.C. ${formatCedula(user.cedula)}`, user.institucion, user.sede, horario].filter(Boolean).join(" · ");

  return (
    <>
      <PageHeader
        title={user.nombre}
        description={descripcion}
        actions={
          <>
            {!user.activo ? (
              <Badge variant="inactivo" className="self-center">Inactivo</Badge>
            ) : avance.sinRostro ? (
              <Badge variant="sin-rostro" className="self-center">Sin rostro</Badge>
            ) : (
              <Badge variant="activo" className="self-center">Activo</Badge>
            )}
            <Link href={`/admin/usuarios/${user.id}/editar`} className={buttonVariants({ variant: "outline" })}>
              Editar datos
            </Link>
          </>
        }
      />

      <div className="flex flex-col gap-6 px-8 py-6">
        {jornadaAbierta && (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border border-l-4 border-l-brand-amber bg-white px-6 py-4">
            <p className="text-[14.5px] font-semibold text-navy">
              Jornada abierta hoy: entrada a las <span className="tabular-nums">{formatTime(jornadaAbierta.marcadoEn)}</span>
            </p>
            <RegistrarSalidaDialog
              entradaId={jornadaAbierta.id}
              entradaHora={formatTime(jornadaAbierta.marcadoEn)}
              sugerida={null}
              temprana
              trigger="Registrar salida temprana"
              triggerStyle="primario"
            />
          </div>
        )}

        <section aria-label="Avance" className="flex items-center gap-6 rounded-xl border border-border bg-white px-6 py-5">
          {!natural && avance.percent !== null && <ProgressRing percent={avance.percent} label="Avance de horas" />}
          <div className="flex min-w-0 flex-col gap-2">
            {natural || avance.percent === null ? (
              <>
                <p className="text-[38px] leading-none font-extrabold tracking-[-0.02em] text-navy tabular-nums">
                  {horas(avance.workedMs)}
                </p>
                <p className="text-sm text-muted-foreground">Horas acumuladas (voluntario sin meta de horas)</p>
              </>
            ) : (
              <>
                <p className="text-[38px] leading-none font-extrabold tracking-[-0.02em] text-navy tabular-nums">
                  {numberFormat.format(msToHours(avance.workedMs))} / {numberFormat.format(avance.horasRequeridas)} h
                </p>
                <p className="text-sm text-muted-foreground tabular-nums">
                  {avance.remainingMs !== null ? `Faltan ${horas(avance.remainingMs)}` : "Sin horas pendientes"}
                </p>
                <ProgressBar percent={avance.percent} label={`Avance de ${user.nombre}`} />
              </>
            )}
          </div>
        </section>

        {inconsistencias.length > 0 && (
          <section aria-labelledby="por-corregir" className="rounded-xl border border-border border-l-4 border-l-brand-red bg-white">
            <div className="flex flex-col gap-1 px-6 pt-4 pb-2">
              <h2 id="por-corregir" className="text-lg font-bold tracking-[-0.02em] text-navy">
                Por corregir <span className="tabular-nums">({inconsistencias.length})</span>
              </h2>
              <p className="text-sm text-muted-foreground">No suman horas hasta corregirlas</p>
            </div>
            <ul>
              {inconsistencias.map((inc) => {
                const hora = formatTime(inc.marca.marcadoEn);
                const dia = formatDayShort(inc.marca.marcadoEn);
                return (
                  <li key={inc.marca.id} className="flex items-center justify-between gap-4 px-6 py-4 even:bg-row-alt">
                    <p className="text-[14.5px] text-navy">
                      <span className="font-semibold">{dia}</span> ·{" "}
                      {inc.tipo === "sin-salida" ? "entrada" : "salida sin entrada"} a las{" "}
                      <span className="tabular-nums">{hora}</span>
                    </p>
                    {inc.tipo === "sin-salida" ? (
                      <RegistrarSalidaDialog
                        entradaId={inc.marca.id}
                        entradaHora={hora}
                        sugerida={horaSugerida(inc.marca.marcadoEn, sugerencia.horaFin, null)}
                        temprana={false}
                        trigger="Registrar salida"
                      />
                    ) : (
                      <RegistrarEntradaDialog salidaId={inc.marca.id} salidaHora={hora} trigger="Registrar entrada" />
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <Historial dias={dias.map(armarDia)} />

        {perfil.pages > 1 && (
          <nav aria-label="Paginación" className="flex items-center justify-between text-sm text-muted-foreground">
            <p className="tabular-nums">
              Página {perfil.page} de {perfil.pages}
            </p>
            <div className="flex gap-2">
              {perfil.page > 1 && (
                <Link href={`/admin/usuarios/${user.id}?page=${perfil.page - 1}`} className={buttonVariants({ variant: "outline" })}>
                  Más recientes
                </Link>
              )}
              {perfil.page < perfil.pages && (
                <Link href={`/admin/usuarios/${user.id}?page=${perfil.page + 1}`} className={buttonVariants({ variant: "outline" })}>
                  Más antiguos
                </Link>
              )}
            </div>
          </nav>
        )}
      </div>
    </>
  );
}
