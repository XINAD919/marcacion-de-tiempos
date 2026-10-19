import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { ProgressBar } from "@/components/admin/progress-bar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatoRestante } from "@/lib/carnets/formato";
import { envioActivo, getEnvio, ultimoEnvioId } from "@/lib/server/envioCarnetsService";
import { AutoRefresh } from "../../reportes/auto-refresh";
import { Controles } from "./controles";

export const metadata: Metadata = { title: "Envío de carnets" };

const numero = new Intl.NumberFormat("es-CO");

function Cifra({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-white px-5 py-4">
      <span className="text-[11.5px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">{label}</span>
      <span className="text-[38px] leading-none font-extrabold tracking-[-0.02em] text-navy tabular-nums">
        {numero.format(value)}
      </span>
    </div>
  );
}

export default async function EnvioCarnetsPage() {
  const activo = await envioActivo();
  const id = activo?.id ?? (await ultimoEnvioId());
  const envio = id ? await getEnvio(id) : null;

  if (!envio) {
    return (
      <>
        <PageHeader title="Envío de carnets" />
        <div className="flex flex-col items-center gap-3 px-8 py-20 text-center">
          <p className="text-[17px] font-semibold text-navy">No hay envíos de carnets.</p>
          <Link href="/admin/usuarios" className="font-semibold text-brand-red-ink hover:underline">
            Volver a Usuarios
          </Link>
        </div>
      </>
    );
  }

  const enCurso = envio.estado === "en-curso";
  const pausado = envio.estado === "pausado";
  const hechos = envio.enviados + envio.omitidos + envio.errores;
  const percent = envio.total === 0 ? 0 : Math.round((envio.enviados / envio.total) * 100);

  return (
    <>
      {enCurso && <AutoRefresh seconds={10} />}
      <PageHeader
        title="Envío de carnets"
        description={enCurso ? "En curso" : pausado ? "Pausado" : undefined}
        actions={
          (enCurso || pausado) && <Controles envioId={envio.id} estado={envio.estado as "en-curso" | "pausado"} />
        }
      />

      <div className="flex flex-col gap-6 px-8 py-6">
        {envio.motivoPausa && (
          <p
            role="status"
            className="rounded-lg border border-brand-amber bg-brand-amber/15 px-4 py-3 text-sm text-brand-amber-ink"
          >
            El envío se pausó solo: {envio.motivoPausa.replace(/\.$/, "")}. Revisa el correo de salida en{" "}
            <Link href="/admin/configuracion" className="font-semibold underline">
              Configuración
            </Link>{" "}
            y luego reanúdalo.
          </p>
        )}

        <section className="flex flex-col gap-3 rounded-lg border border-border bg-white p-5">
          <ProgressBar percent={percent} label="Avance del envío de carnets" className="bg-track [&>div]:bg-brand-green" />
          <p className="text-sm font-semibold text-navy tabular-nums">
            {numero.format(envio.enviados)} / {numero.format(envio.total)} enviados
            {hechos > envio.enviados && (
              <span className="font-normal text-muted-foreground">
                {" "}
                · {numero.format(hechos)} procesados
              </span>
            )}
          </p>
          {(enCurso || pausado) && (
            <p className="text-sm text-muted-foreground tabular-nums">
              Tiempo estimado restante: {formatoRestante(envio.estimadoRestanteMs)}
            </p>
          )}
          {envio.estado === "terminado" && <p className="text-sm font-semibold text-brand-green-ink">Envío terminado</p>}
        </section>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(0,1fr))] gap-4 sm:grid-cols-4">
          <Cifra label="Enviados" value={envio.enviados} />
          <Cifra label="Pendientes" value={envio.pendientes} />
          <Cifra label="Omitidos" value={envio.omitidos} />
          <Cifra label="Con error" value={envio.errores} />
        </div>

        {envio.erroresDetalle.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-[17px] font-semibold text-navy">Carnets con error</h2>
            <div className="bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Correo</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {envio.erroresDetalle.map((fila) => (
                    <TableRow key={fila.userId}>
                      <TableCell className="font-semibold">{fila.nombre}</TableCell>
                      <TableCell>{fila.email ?? "—"}</TableCell>
                      <TableCell>{fila.motivo}</TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/admin/usuarios/${fila.userId}/editar`}
                          className="font-semibold text-brand-red-ink hover:underline"
                        >
                          Editar<span className="sr-only"> a {fila.nombre}</span>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        )}
      </div>
    </>
  );
}
