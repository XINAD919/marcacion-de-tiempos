"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { InstitucionCombobox } from "@/components/admin/institucion-combobox";
import { PageHeader } from "@/components/admin/page-header";
import { SegmentedControl } from "@/components/admin/segmented-control";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { notificar } from "@/lib/client/avisos";
import type { InstitucionOpcion } from "@/lib/catalogo/institucion";
import { etiquetaOpcion, opcionesVisibles } from "@/lib/catalogo/nombres";
import type { SedeOpcion } from "@/lib/catalogo/sede";
import { precargar } from "@/lib/usuarios/precarga";
import { TIPOS_USUARIO, TIPO_USUARIO_LABEL, type TipoUsuario, isTipoUsuario } from "@/lib/usuarios/tipoUsuario";
import { estimateEndDate, parseIsoDate, type UsuarioField } from "@/lib/usuarios/userInput";
import { type UsuarioFormState, guardarUsuario } from "./actions";
import { type CarnetInfo, CarnetCard } from "./carnet-card";

export interface UsuarioFormDefaults {
  tipo: TipoUsuario;
  nombre: string;
  cedula: string;
  email: string;
  institucionId: string;
  sedeId: string;
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
  /** Solo al editar: estado del carnet virtual. */
  carnet?: CarnetInfo;
  instituciones: InstitucionOpcion[];
  sedes: SedeOpcion[];
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

export function UsuarioForm({ userId, defaults, fotos, carnet, instituciones, sedes }: UsuarioFormProps) {
  const [state, action, pending] = useActionState<UsuarioFormState, FormData>(guardarUsuario, {
    status: "idle",
  });
  const router = useRouter();

  useEffect(() => {
    if (state.status === "saved") {
      notificar({ ok: true }, "Usuario guardado");
      router.push(state.redirectTo);
    } else if (state.status === "invalid") notificar({ ok: false, errors: state.errors }, "");
    else if (state.status === "error") notificar({ ok: false, message: state.message }, "");
  }, [state, router]);

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
  const [tipo, setTipo] = useState<TipoUsuario>(isTipoUsuario(values.tipo) ? values.tipo : "practicante");
  const esNatural = tipo === "natural";

  const formRef = useRef<HTMLFormElement>(null);
  // Último valor que propuso el catálogo, para no pisar lo escrito a mano.
  const propuesto = useRef<{ horas: string | null; horaInicio: string | null; horaFin: string | null }>({
    horas: null,
    horaInicio: null,
    horaFin: null,
  });
  const institucionActual = Number(values.institucionId) || null;
  const sedeActual = Number(values.sedeId) || null;

  function readPlan(form: HTMLFormElement) {
    const data = new FormData(form);
    return {
      fechaInicio: String(data.get("fechaInicio") ?? ""),
      horasRequeridas: String(data.get("horasRequeridas") ?? ""),
      horaInicio: String(data.get("horaInicio") ?? ""),
      horaFin: String(data.get("horaFin") ?? ""),
    };
  }

  /** Escribe la propuesta en el campo (no controlado) y recuerda qué se propuso. */
  function proponer(
    name: "horasRequeridas" | "horaInicio" | "horaFin",
    key: "horas" | "horaInicio" | "horaFin",
    valor: string | null
  ) {
    const input = formRef.current?.elements.namedItem(name);
    if (!(input instanceof HTMLInputElement)) return;
    const next = precargar(input.value, propuesto.current[key], valor);
    if (next !== input.value) {
      input.value = next;
      propuesto.current[key] = next;
    }
  }

  function aplicarInstitucion(institucion: InstitucionOpcion | null) {
    if (!institucion || !formRef.current) return;
    proponer("horasRequeridas", "horas", institucion.horasExigidas > 0 ? String(institucion.horasExigidas) : null);
    setPlan(readPlan(formRef.current));
  }

  function aplicarSede(sede: SedeOpcion | null) {
    if (!sede || !formRef.current) return;
    proponer("horaInicio", "horaInicio", sede.horaApertura);
    proponer("horaFin", "horaFin", sede.horaCierre);
    setPlan(readPlan(formRef.current));
  }
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
      ref={formRef}
      onChange={(event) => {
        const nextTipo = new FormData(event.currentTarget).get("tipo");
        if (isTipoUsuario(nextTipo)) setTipo(nextTipo);
        setPlan(readPlan(event.currentTarget));
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
          <Card title="Tipo de usuario">
            <SegmentedControl
              name="tipo"
              label="Tipo de usuario"
              defaultValue={tipo}
              options={TIPOS_USUARIO.map((value) => ({ value, label: TIPO_USUARIO_LABEL[value] }))}
            />
            {errors.tipo ? (
              <p id="tipo-error" className="mt-3 text-[12.5px] leading-[1.45] text-brand-red-ink">
                {errors.tipo}
              </p>
            ) : (
              <p className="mt-3 text-[13px] leading-normal text-muted-foreground">
                {esNatural
                  ? "Voluntario sin práctica formal: suma horas, pero sin meta ni institución."
                  : "Practicante con convenio: tiene horas requeridas y fecha estimada de fin."}
              </p>
            )}
          </Card>

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

          {!esNatural && (
            <Card title="Práctica">
              <div className="grid grid-cols-2 gap-x-5 gap-y-4.5">
                <Field id="institucionId" label="Institución" required error={errors.institucionId}>
                  <InstitucionCombobox
                    id="institucionId"
                    name="institucionId"
                    instituciones={instituciones}
                    defaultValue={institucionActual}
                    invalid={Boolean(errors.institucionId)}
                    onValueChange={aplicarInstitucion}
                  />
                </Field>
                <Field
                  id="sedeId"
                  label="Sede"
                  required
                  error={errors.sedeId}
                  hint={
                    <>
                      ¿No está en la lista?{" "}
                      <Link
                        href="/admin/instituciones-y-sedes"
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-brand-red-ink hover:underline"
                      >
                        Agrégala en Instituciones y sedes
                      </Link>{" "}
                      (se abre en otra pestaña).
                    </>
                  }
                >
                  <div className="relative">
                    <select
                      id="sedeId"
                      name="sedeId"
                      defaultValue={values.sedeId}
                      onChange={(event) => aplicarSede(sedes.find((sede) => String(sede.id) === event.target.value) ?? null)}
                      {...invalid("sedeId")}
                      className="h-11 w-full cursor-pointer appearance-none rounded-lg border-[1.5px] border-input bg-white pr-10 pl-3.5 text-[14.5px] text-navy outline-none focus-visible:border-navy focus-visible:ring-3 focus-visible:ring-navy/15 aria-invalid:border-brand-red aria-invalid:ring-3 aria-invalid:ring-brand-red/15"
                    >
                      <option value="">Elige una sede</option>
                      {opcionesVisibles(sedes, sedeActual).map((sede) => (
                        <option key={sede.id} value={sede.id}>
                          {etiquetaOpcion(sede)}
                        </option>
                      ))}
                    </select>
                    <span aria-hidden className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-xs text-navy">
                      ▾
                    </span>
                  </div>
                </Field>
                <Field
                  id="horasRequeridas"
                  label="Horas requeridas"
                  required
                  hint="Se proponen las de la institución; las define el convenio."
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
                  hint="Se propone el de la sede. Sirve para marcar llegadas tarde."
                  error={errors.horaInicio ?? errors.horaFin}
                >
                  <div className="flex items-center gap-2">
                    <Input
                      id="horaInicio"
                      name="horaInicio"
                      type="time"
                      aria-label="Hora de inicio"
                      defaultValue={plan.horaInicio}
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
                      defaultValue={plan.horaFin}
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
            </Card>
          )}

          {esNatural && (
            <Card title="Horario">
              <div className="grid grid-cols-2 gap-x-5 gap-y-4.5">
                <Field id="horaInicio" label="Hora de llegada" required error={errors.horaInicio}>
                  <Input
                    id="horaInicio"
                    name="horaInicio"
                    type="time"
                    defaultValue={plan.horaInicio}
                    className="tabular-nums"
                    {...invalid("horaInicio")}
                  />
                </Field>
                <Field
                  id="horaFin"
                  label="Hora de salida"
                  required
                  hint="Sirve para marcar llegadas tarde con la tolerancia de voluntarios."
                  error={errors.horaFin}
                >
                  <Input
                    id="horaFin"
                    name="horaFin"
                    type="time"
                    defaultValue={plan.horaFin}
                    className="tabular-nums"
                    {...invalid("horaFin")}
                  />
                </Field>
              </div>
            </Card>
          )}
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

          {userId && carnet && (
            <Card title="Carnet virtual">
              <CarnetCard
                userId={userId}
                email={defaults.email || null}
                activo={defaults.activo === "true"}
                carnet={carnet}
              />
            </Card>
          )}

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
        </p>
        <Link href="/admin/usuarios" className={buttonVariants({ variant: "outline" })}>
          Cancelar
        </Link>
        <Button type="submit" name="intent" value="guardar" variant="outline" disabled={pending || state.status === "saved"}>
          Guardar
        </Button>
        <Button type="submit" name="intent" value="enrolar" disabled={pending || state.status === "saved"}>
          {pending ? "Guardando…" : "Guardar y enrolar rostro"}
        </Button>
      </footer>
    </form>
  );
}
