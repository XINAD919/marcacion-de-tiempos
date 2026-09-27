"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ImportIssue } from "@/lib/usuarios/importRows";

interface ImportResult {
  archivo: string;
  filasLeidas: number;
  segundos: number;
  insertados: number;
  duplicados: ImportIssue[];
  errores: ImportIssue[];
  columnasFaltantes: string[];
  filasConErrorXlsx: string | null;
}

const numberFormat = new Intl.NumberFormat("es-CO");
const fmt = (n: number) => numberFormat.format(n);

function downloadBase64Xlsx(base64: string, filename: string) {
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  const url = URL.createObjectURL(
    new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
  );
  const link = Object.assign(document.createElement("a"), { href: url, download: filename });
  link.click();
  URL.revokeObjectURL(url);
}

export function Importador() {
  const router = useRouter();
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function importar(formData: FormData) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/usuarios/importar", { method: "POST", body: formData });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body?.error ?? "No se pudo importar el archivo. Inténtalo de nuevo.");
      } else {
        setResult(body);
        router.refresh();
      }
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Importar desde Excel"
        description={
          <Link href="/admin/usuarios" className="font-semibold text-brand-red-ink hover:underline">
            ‹ Usuarios
          </Link>
        }
      />
      <div className="flex justify-center px-8 py-8">
        {result ? <Resultado result={result} onOtro={() => setResult(null)} /> : (
          <section className="flex w-full max-w-190 flex-col gap-5.5 rounded-2xl border border-border bg-white p-8">
            <div>
              <h2 className="text-[20px] font-bold text-navy">Sube el Excel de practicantes</h2>
              <p className="mt-1.5 text-sm leading-normal text-muted-foreground">
                Se lee la primera hoja. La primera fila debe tener los encabezados; los demás se
                pueden escribir con o sin tildes.
              </p>
            </div>

            <div className="rounded-xl bg-bone-2 px-5 py-4 text-sm leading-relaxed text-navy">
              <p className="font-semibold">Columnas</p>
              <p>
                <strong>Obligatorias:</strong> Nombre (o Nombres y Apellidos), Cédula, Universidad /
                Colegio, Entidad, Horas requeridas.
              </p>
              <p>
                <strong>Opcionales:</strong> Correo, Fecha de inicio (dd/mm/aaaa), Hora de inicio y
                Hora de fin (08:00).
              </p>
              <a
                href="/api/usuarios/importar/plantilla"
                className="mt-2 inline-block font-semibold text-brand-red-ink hover:underline"
              >
                Descargar plantilla de ejemplo
              </a>
            </div>

            <form action={importar} className="flex flex-col gap-4">
              <label
                htmlFor="archivo"
                className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-[1.5px] border-dashed border-navy/30 px-6 py-8 text-center hover:bg-row-alt has-focus-visible:ring-3 has-focus-visible:ring-navy/15"
              >
                <span className="text-[15px] font-semibold text-navy">Elige el archivo</span>
                <span className="text-[13px] text-muted-foreground">.xlsx, .xls o .csv · hasta 5 MB</span>
                <input
                  id="archivo"
                  name="archivo"
                  type="file"
                  required
                  accept=".xlsx,.xls,.csv"
                  className="mt-2 text-sm text-navy file:mr-3 file:cursor-pointer file:rounded-lg file:border-[1.5px] file:border-navy/25 file:bg-white file:px-3.5 file:py-2 file:text-sm file:font-semibold file:text-navy"
                />
              </label>

              {error && (
                <p role="alert" className="text-sm font-semibold text-brand-red-ink">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-2.5">
                <Link href="/admin/usuarios" className={buttonVariants({ variant: "outline" })}>
                  Cancelar
                </Link>
                <Button type="submit" disabled={pending}>
                  {pending ? "Importando… puede tardar un momento" : "Importar"}
                </Button>
              </div>
            </form>
          </section>
        )}
      </div>
    </>
  );
}

function Cifra({ value, label, tone }: { value: number; label: string; tone: "green" | "amber" | "red" }) {
  const color = { green: "text-brand-green-ink", amber: "text-brand-amber-ink", red: "text-brand-red-ink" }[tone];
  return (
    <div className="flex-1 rounded-xl border border-border bg-white px-5 py-4">
      <p className={`text-[40px] leading-none font-extrabold tabular-nums ${color}`}>{fmt(value)}</p>
      <p className="mt-2 text-sm font-semibold text-navy">{label}</p>
    </div>
  );
}

/** Maqueta 2b: tres cifras y detalle de las filas con error en español llano. */
function Resultado({ result, onOtro }: { result: ImportResult; onOtro: () => void }) {
  const failed = result.columnasFaltantes.length > 0;

  return (
    <section className="flex w-full max-w-240 flex-col gap-5.5 rounded-2xl border border-border bg-bone p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[22px] font-bold text-navy">
            {failed ? "No se pudo importar" : "Importación terminada"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground tabular-nums">
            {result.archivo} · {fmt(result.filasLeidas)} filas leídas · {result.segundos} s
          </p>
        </div>
        <Link href="/admin/usuarios" aria-label="Cerrar" className="px-2 text-lg text-navy/60 hover:text-navy">
          ✕
        </Link>
      </div>

      {failed ? (
        <div role="alert" className="rounded-xl border border-brand-red/30 bg-[#f9e8ea] px-5 py-4 text-brand-red-ink">
          <p className="font-bold">Al archivo le faltan columnas obligatorias</p>
          <p className="mt-1 text-sm">
            No se encontró: {result.columnasFaltantes.join(", ")}. Revisa los encabezados de la primera
            fila o descarga la plantilla. No se importó ningún usuario.
          </p>
        </div>
      ) : (
        <>
          <div className="flex gap-4">
            <Cifra value={result.insertados} label="Usuarios insertados" tone="green" />
            <Cifra value={result.duplicados.length} label="Duplicados, se omitieron" tone="amber" />
            <Cifra value={result.errores.length} label="Con error, no se importaron" tone="red" />
          </div>

          {result.errores.length > 0 && (
            <IssuesTable
              title="FILAS CON ERROR"
              issues={result.errores}
              action={
                result.filasConErrorXlsx && (
                  <Button
                    variant="link"
                    onClick={() => downloadBase64Xlsx(result.filasConErrorXlsx!, "filas-para-corregir.xlsx")}
                  >
                    {result.errores.length === 1
                      ? "Descargar la fila para corregir"
                      : `Descargar las ${fmt(result.errores.length)} filas para corregir`}
                  </Button>
                )
              }
            />
          )}

          {result.duplicados.length > 0 && (
            <details className="rounded-xl border border-border bg-white">
              <summary className="cursor-pointer px-5 py-3.5 text-sm font-semibold text-navy">
                {result.duplicados.length === 1
                  ? "Ver el duplicado"
                  : `Ver los ${fmt(result.duplicados.length)} duplicados`}
              </summary>
              <IssuesTable issues={result.duplicados} />
            </details>
          )}

          {result.insertados > 0 && (
            <p className="text-sm text-muted-foreground">
              {result.insertados === 1
                ? "El usuario nuevo queda sin rostro registrado hasta que lo enroles."
                : `Los ${fmt(result.insertados)} usuarios nuevos quedan sin rostro registrado hasta que los enroles.`}
            </p>
          )}
        </>
      )}

      <div className="flex justify-end gap-2.5">
        <Button variant="outline" onClick={onOtro}>
          Importar otro archivo
        </Button>
        {result.insertados > 0 ? (
          <Link href="/admin/usuarios?estado=sin-rostro" className={buttonVariants()}>
            Ir a enrolar rostros
          </Link>
        ) : (
          <Link href="/admin/usuarios" className={buttonVariants()}>
            Cerrar
          </Link>
        )}
      </div>
    </section>
  );
}

function IssuesTable({
  title,
  issues,
  action,
}: {
  title?: string;
  issues: ImportIssue[];
  action?: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white">
      {title && (
        <div className="flex items-center justify-between px-5 py-3">
          <p className="text-[11.5px] font-semibold tracking-[0.09em] text-navy/70">{title}</p>
          {action}
        </div>
      )}
      <div className="max-h-90 overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Fila</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Cédula</TableHead>
              <TableHead>Motivo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {issues.map((issue) => (
              <TableRow key={issue.fila}>
                <TableCell className="tabular-nums">{issue.fila}</TableCell>
                <TableCell>{issue.nombre || "—"}</TableCell>
                <TableCell className="tabular-nums">{issue.cedula || "—"}</TableCell>
                <TableCell className="whitespace-normal">{issue.motivo}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
