"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { SegmentedControl } from "@/components/admin/segmented-control";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { estimateEndDate, parseIsoDate, type UsuarioField } from "@/lib/usuarios/userInput";
import { type UsuarioFormState, guardarUsuario } from "./actions";

export interface UsuarioFormDefaults {
  nombre: string;
  cedula: string;
  email: string;
  universidad: string;
  entidad: string;
  horasRequeridas: string;
  fechaInicio: string;
  horaInicio: string;
  horaFin: string;
  activo: "true" | "false";
}

interface UsuarioFormProps {
  /** Si viene, se edita ese usuario; si no, se crea uno nuevo. */
  userId?: string;
  defaults: UsuarioFormDefaults;
  fotos: number;
  universidades: string[];
  entidades: string[];
}

const longDate = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric" });

function Field({
  id,
  label,
  required,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.75">
      <label htmlFor={id} className="text-[13px] font-semibold text-navy">
        {label}
        {required && (
          <span aria-hidden className="text-brand-red-ink">
            {" "}
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-[12.5px] leading-[1.45] text-brand-red-ink">
          {error}
        </p>
      ) : (
        hint && <p className="text-[12.5px] leading-[1.45] text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-white p-6">
      <h2 className="mb-4.5 text-[17px] font-bold text-navy">{title}</h2>
      {children}
    </section>
  );
}

export function UsuarioForm({ userId, defaults, fotos, universidades, entidades }: UsuarioFormProps) {
  const [state, action, pending] = useActionState<UsuarioFormState, FormData>(guardarUsuario, {
    status: "idle",
  });
  const values: Record<string, string> = state.status === "idle" ? { ...defaults } : state.values;
  const errors = state.status === "invalid" ? state.errors : {};
  const errorCount = Object.keys(errors).length;

  // Lo necesario para la fecha estimada de fin, que se recalcula al escribir.
  const [plan, setPlan] = useState({
    fechaInicio: values.fechaInicio,
    horasRequeridas: values.horasRequeridas,
    horaInicio: values.horaInicio,
    horaFin: values.horaFin,
  });
  const fecha = parseIsoDate(plan.fechaInicio);
  const estimate = fecha
    ? estimateEndDate(fecha, Number(plan.horasRequeridas), plan.horaInicio || null, plan.horaFin || null)
    : null;

  const invalid = (field: UsuarioField) =>
    errors[field] ? { "aria-invalid": true, "aria-describedby": `${field}-error` } : {};

  return (
    <form
      action={action}
      noValidate
      onChange={(event) => {
        const data = new FormData(event.currentTarget);
        setPlan({
          fechaInicio: String(data.get("fechaInicio") ?? ""),
          horasRequeridas: String(data.get("horasRequeridas") ?? ""),
          horaInicio: String(data.get("horaInicio") ?? ""),
          horaFin: String(data.get("horaFin") ?? ""),
        });
      }}
      className="flex min-h-full flex-col"
    >
      {userId && <input type="hidden" name="userId" value={userId} />}

      <PageHeader
        title={userId ? "Editar usuario" : "Crear usuario"}
        description={
          <>
            <Link href="/admin/usuarios" className="font-semibold text-brand-red-ink hover:underline">
              ‹ Usuarios
            </Link>
            {" · "}Los campos con <span className="text-brand-red-ink">*</span> son obligatorios.
          </>
        }
      />

      <div className="grid flex-1 grid-cols-[minmax(0,1fr)_minmax(280px,340px)] items-start gap-6 px-8 py-6">
        <div className="flex flex-col gap-4.5">
          <Card title="Datos personales">
            <div className="grid grid-cols-2 gap-x-5 gap-y-4.5">
              <div className="col-span-2">
                <Field id="nombre" label="Nombre completo" required error={errors.nombre}>
                  <Input id="nombre" name="nombre" defaultValue={values.nombre} autoComplete="off" {...invalid("nombre")} />
                </Field>
              </div>
              <Field
                id="cedula"
                label="Cédula / documento"
                required
                error={
                  errors.cedula && (
                    <>
                      {errors.cedula}{" "}
                      {state.status === "invalid" && state.duplicate && (
                        <Link
                          href={`/admin/usuarios/${state.duplicate.id}/editar`}
                          className="font-semibold underline"
                        >
                          Ver usuario
                        </Link>
                      )}
                    </>
                  )
                }
              >
                <Input
                  id="cedula"
                  name="cedula"
                  inputMode="numeric"
                  defaultValue={values.cedula}
                  className="tabular-nums"
                  {...invalid("cedula")}
                />
              </Field>
              <Field id="email" label="Correo" hint="Opcional." error={errors.email}>
                <Input id="email" name="email" type="email" defaultValue={values.email} {...invalid("email")} />
              </Field>
            </div>
          </Card>

          <Card title="Práctica">
            <div className="grid grid-cols-2 gap-x-5 gap-y-4.5">
              <Field id="universidad" label="Universidad / Colegio" required error={errors.universidad}>
                <Input
                  id="universidad"
                  name="universidad"
                  list="universidades"
                  defaultValue={values.universidad}
                  {...invalid("universidad")}
                />
              </Field>
              <Field id="entidad" label="Entidad donde practica" required error={errors.entidad}>
                <Input id="entidad" name="entidad" list="entidades" defaultValue={values.entidad} {...invalid("entidad")} />
              </Field>
              <Field
                id="horasRequeridas"
                label="Horas requeridas"
                required
                hint="Las define el convenio con la institución."
                error={errors.horasRequeridas}
              >
                <Input
                  id="horasRequeridas"
                  name="horasRequeridas"
                  inputMode="numeric"
                  defaultValue={values.horasRequeridas}
                  className="tabular-nums"
                  {...invalid("horasRequeridas")}
                />
              </Field>
              <Field
                id="horaInicio"
                label="Horario asignado (lunes a viernes)"
                hint="Sirve para marcar llegadas tarde."
                error={errors.horaInicio ?? errors.horaFin}
              >
                <div className="flex items-center gap-2">
                  <Input
                    id="horaInicio"
                    name="horaInicio"
                    type="time"
                    aria-label="Hora de inicio"
                    defaultValue={values.horaInicio}
                    className="tabular-nums"
                    {...invalid("horaInicio")}
                  />
                  <span aria-hidden className="text-navy/60">
                    –
                  </span>
                  <Input
                    id="horaFin"
                    name="horaFin"
                    type="time"
                    aria-label="Hora de fin"
                    defaultValue={values.horaFin}
                    className="tabular-nums"
                    {...(errors.horaFin ? { "aria-invalid": true, "aria-describedby": "horaInicio-error" } : {})}
                  />
                </div>
              </Field>
              <Field id="fechaInicio" label="Fecha de inicio" required error={errors.fechaInicio}>
                <Input
                  id="fechaInicio"
                  name="fechaInicio"
                  type="date"
                  defaultValue={values.fechaInicio}
                  className="tabular-nums"
                  {...invalid("fechaInicio")}
                />
              </Field>
              <Field id="fechaFin" label="Fecha estimada de fin" hint="Días hábiles al ritmo del horario; no descuenta festivos.">
                <p
                  id="fechaFin"
                  aria-live="polite"
                  className="flex h-11 items-center rounded-lg border-[1.5px] border-input bg-bone-2 px-3.5 text-[14.5px] text-navy tabular-nums"
                >
                  {estimate ? longDate.format(estimate) : <span className="text-navy/55">Completa horas, horario y fecha</span>}
                </p>
              </Field>
            </div>
            <datalist id="universidades">
              {universidades.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
            <datalist id="entidades">
              {entidades.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
          </Card>
        </div>

        <div className="flex flex-col gap-4.5">
          <Card title="Rostro">
            <div className="flex items-center gap-4">
              <span
                className={
                  fotos > 0
                    ? "flex h-20 w-16 flex-none items-center justify-center rounded-lg bg-[#e3f1e9] text-center text-[11px] font-semibold text-brand-green-ink"
                    : "flex h-20 w-16 flex-none items-center justify-center rounded-lg bg-[#fbeedd] text-center text-[11px] font-semibold text-brand-amber-ink"
                }
              >
                {fotos > 0 ? `${fotos} FOTOS` : "SIN FOTOS"}
              </span>
              <p className="text-[13.5px] leading-normal text-muted-foreground">
                {fotos > 0
                  ? "Ya puede marcar en el kiosko. Puedes repetir el enrolamiento si cambió mucho su apariencia."
                  : "Sin rostro no podrá marcar en el kiosko."}
              </p>
            </div>
            {userId && (
              <Link
                href={`/admin/enrolar/${userId}`}
                className="mt-4 inline-block text-sm font-semibold text-brand-red-ink hover:underline"
              >
                {fotos > 0 ? "Repetir enrolamiento" : "Enrolar rostro"}
              </Link>
            )}
          </Card>

          <Card title="Estado">
            <SegmentedControl
              name="activo"
              label="Estado"
              defaultValue={values.activo}
              options={[
                { value: "true", label: "Activo" },
                { value: "false", label: "Inactivo" },
              ]}
            />
            <p className="mt-3 text-[13px] leading-normal text-muted-foreground">
              Los inactivos conservan su historial y dejan de marcar.
            </p>
          </Card>
        </div>
      </div>

      <footer className="sticky bottom-0 flex items-center justify-end gap-2.5 border-t border-border bg-white px-8 py-4">
        <p role="status" className="mr-auto text-[13.5px] font-medium text-brand-red-ink">
          {errorCount > 0 &&
            `Corrige ${errorCount} ${errorCount === 1 ? "campo" : "campos"} para poder guardar`}
          {state.status === "error" && state.message}
        </p>
        <Link href="/admin/usuarios" className={buttonVariants({ variant: "outline" })}>
          Cancelar
        </Link>
        <Button type="submit" name="intent" value="guardar" variant="outline" disabled={pending}>
          Guardar
        </Button>
        <Button type="submit" name="intent" value="enrolar" disabled={pending}>
          {pending ? "Guardando…" : "Guardar y enrolar rostro"}
        </Button>
      </footer>
    </form>
  );
}
