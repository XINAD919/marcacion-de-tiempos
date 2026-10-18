import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TIPO_INSTITUCION_LABEL } from "@/lib/catalogo/institucion";
import { formatHorario } from "@/lib/catalogo/sede";
import { type SedeConConteo, listCatalogoConConteos } from "@/lib/server/catalogoService";
import { cn } from "@/lib/utils";
import { InstitucionDialog } from "./institucion-dialog";
import { SedeDialog } from "./sede-dialog";

export const metadata: Metadata = { title: "Instituciones y sedes" };

const numberFormat = new Intl.NumberFormat("es-CO");

// .62 y no .55: a 11,5 px el .55 de la maqueta no llega a 4,5:1 sobre blanco.
const LABEL = "text-[11.5px] font-semibold tracking-[.08em] text-navy/62 uppercase";

function SedeCard({ sede }: { sede: SedeConConteo }) {
  return (
    <article
      className={cn(
        "flex h-full flex-col gap-3.5 rounded-[10px] border border-border p-5.5",
        sede.activa ? "bg-white" : "bg-row-alt"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-navy">{sede.nombre}</h3>
          <p className="mt-1 text-[13px] text-navy/70">{sede.direccion ?? "Sin dirección"}</p>
        </div>
        <SedeDialog sede={sede} triggerStyle="enlace" />
      </div>
      {!sede.activa && (
        <Badge variant="inactivo" className="self-start">
          Inactiva
        </Badge>
      )}
      <dl className="grid grid-cols-2 gap-3">
        <div>
          <dt className={LABEL}>Practicantes</dt>
          <dd className="mt-1 text-[30px] leading-[1.1] font-extrabold text-navy tabular-nums">
            {numberFormat.format(sede.practicantes)}
          </dd>
        </div>
        <div>
          <dt className={LABEL}>Horario</dt>
          <dd className="mt-2 text-[15px] leading-[1.3] font-semibold text-navy tabular-nums">
            {formatHorario(sede.horaApertura, sede.horaCierre)}
          </dd>
        </div>
      </dl>
    </article>
  );
}

function Vacio({ children }: { children: React.ReactNode }) {
  return <p className="px-5.5 py-10 text-center text-sm text-muted-foreground">{children}</p>;
}

export default async function InstitucionesYSedesPage() {
  const { instituciones, sedes } = await listCatalogoConConteos();

  return (
    <>
      <PageHeader
        title="Instituciones y sedes"
        description="Dónde practican y desde qué instituciones vienen"
        actions={
          <>
            <InstitucionDialog triggerStyle="secundario" />
            <SedeDialog triggerStyle="primario" />
          </>
        }
      />

      <div className="flex flex-col gap-5.5 px-8 py-6">
        <section aria-labelledby="sedes-titulo">
          <h2 id="sedes-titulo" className="sr-only">
            Sedes
          </h2>
          {sedes.length === 0 ? (
            <div className="rounded-[10px] border border-border bg-white">
              <Vacio>Aún no hay sedes. Agrega la primera con «+ Agregar sede».</Vacio>
            </div>
          ) : (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4.5">
              {sedes.map((sede) => (
                <li key={sede.id}>
                  <SedeCard sede={sede} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          aria-labelledby="instituciones-titulo"
          className="overflow-hidden rounded-[10px] border border-border bg-white"
        >
          <h2 id="instituciones-titulo" className="border-b border-navy/10 px-5.5 py-4 text-[17px] font-bold text-navy">
            Instituciones educativas
          </h2>
          {instituciones.length === 0 ? (
            <Vacio>Aún no hay instituciones. Agrega la primera con «+ Agregar institución».</Vacio>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Activos</TableHead>
                  <TableHead className="text-right">Horas exigidas</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Acciones</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {instituciones.map((institucion) => (
                  <TableRow key={institucion.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <span className="font-medium">{institucion.nombre}</span>
                        {!institucion.activa && <Badge variant="inactivo">Inactiva</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-navy/75">{TIPO_INSTITUCION_LABEL[institucion.tipo]}</TableCell>
                    <TableCell className="text-right tabular-nums">{numberFormat.format(institucion.activos)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {institucion.horasExigidas > 0 ? numberFormat.format(institucion.horasExigidas) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <InstitucionDialog institucion={institucion} triggerStyle="enlace" />
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
