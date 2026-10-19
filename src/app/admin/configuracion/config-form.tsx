"use client";

import { useActionState, useEffect } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { SegmentedControl } from "@/components/admin/segmented-control";
import { SettingRow, SettingsCard } from "@/components/admin/setting-row";
import { UnitInput } from "@/components/admin/unit-input";
import { Button } from "@/components/ui/button";
import { notificar } from "@/lib/client/avisos";
import { type ConfigField, type ConfigValues, EXIGENCIAS, EXIGENCIA_LABEL } from "@/lib/configRules";
import { type ConfigFormState, guardarConfiguracion } from "./actions";

const FORM_ID = "configuracion";
const INTENTOS_OPCIONES = [2, 3, 5];

function formatHours(minutes: number): string {
  return String(minutes / 60).replace(".", ",");
}

interface ConfigFormProps {
  config: ConfigValues;
  aside: React.ReactNode;
  /** Tarjetas con su propio formulario (p. ej. correo de salida), bajo las reglas. */
  children?: React.ReactNode;
}

export function ConfigForm({ config, aside, children }: ConfigFormProps) {
  const [state, action, pending] = useActionState<ConfigFormState, FormData>(guardarConfiguracion, {
    status: "idle",
  });

  useEffect(() => {
    if (state.status === "saved") notificar({ ok: true }, "Configuración guardada");
    else if (state.status === "invalid") notificar({ ok: false, errors: state.errors }, "");
    else if (state.status === "error") notificar({ ok: false, message: state.message }, "");
  }, [state]);

  const errors = state.status === "invalid" ? state.errors : {};
  const typed = state.status === "invalid" ? state.values : {};
  const value = (field: ConfigField, saved: string) => typed[field] ?? saved;
  const describedBy = (field: ConfigField) => (errors[field] ? `${field}-error` : undefined);

  // Si alguien guardó un valor fuera de 2/3/5, se muestra también como opción.
  const intentos = [...new Set([...INTENTOS_OPCIONES, config.intentosAntesQr])].sort((a, b) => a - b);

  return (
    <>
      <PageHeader
        title="Configuración"
        description="Reglas que aplican a todas las sedes y kioskos"
        actions={
          <Button type="submit" form={FORM_ID} disabled={pending}>
            {pending ? "Guardando…" : "Guardar cambios"}
          </Button>
        }
      />

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(320px,380px)] items-start gap-6 px-8 py-6">
        <div className="flex min-w-0 flex-col gap-4.5">
          <form id={FORM_ID} action={action} className="flex flex-col gap-4.5" noValidate>
            <SettingsCard title="Marcación">
              <SettingRow
                htmlFor="toleranciaLlegadaMin"
                title="Tolerancia de llegada"
                description="Practicantes de universidad y colegio: minutos después de la hora de inicio antes de contar como llegada tarde."
                error={errors.toleranciaLlegadaMin}
              >
                <UnitInput
                  id="toleranciaLlegadaMin"
                  name="toleranciaLlegadaMin"
                  unit="minutos"
                  inputMode="numeric"
                  defaultValue={value("toleranciaLlegadaMin", String(config.toleranciaLlegadaMin))}
                  aria-invalid={Boolean(errors.toleranciaLlegadaMin) || undefined}
                  aria-describedby={describedBy("toleranciaLlegadaMin")}
                />
              </SettingRow>

              <SettingRow
                htmlFor="minHorasAntesSalida"
                title="Tiempo mínimo antes de la salida"
                description="Practicantes de universidad y colegio. Si alguien intenta marcar salida antes de este tiempo desde su entrada, el kiosko no la registra y le pide hablar con coordinación."
                error={errors.minHorasAntesSalida}
              >
                <UnitInput
                  id="minHorasAntesSalida"
                  name="minHorasAntesSalida"
                  unit="horas"
                  defaultValue={value("minHorasAntesSalida", formatHours(config.minMinutosAntesSalida))}
                  aria-invalid={Boolean(errors.minHorasAntesSalida) || undefined}
                  aria-describedby={describedBy("minHorasAntesSalida")}
                />
              </SettingRow>

              <SettingRow
                title="Exigencia del reconocimiento"
                description="Más estricto evita confusiones entre personas parecidas, pero fallará más a menudo y remitirá más gente a coordinación."
                error={errors.exigenciaReconocimiento}
              >
                <SegmentedControl
                  name="exigenciaReconocimiento"
                  label="Exigencia del reconocimiento"
                  defaultValue={value("exigenciaReconocimiento", config.exigenciaReconocimiento)}
                  options={EXIGENCIAS.map((exigencia) => ({
                    value: exigencia,
                    label: EXIGENCIA_LABEL[exigencia],
                  }))}
                />
              </SettingRow>

              <SettingRow
                title="Intentos antes de pedir el respaldo"
                description="Cuántas veces seguidas intenta reconocer el rostro antes de remitir al practicante a coordinación y pedirle el QR de su carnet virtual."
                error={errors.intentosAntesQr}
              >
                <SegmentedControl
                  name="intentosAntesQr"
                  label="Intentos antes de pedir el respaldo"
                  defaultValue={value("intentosAntesQr", String(config.intentosAntesQr))}
                  options={intentos.map((n) => ({ value: String(n), label: String(n) }))}
                />
              </SettingRow>
            </SettingsCard>

            <SettingsCard title="Voluntarios naturales">
              <SettingRow
                htmlFor="toleranciaLlegadaNaturalMin"
                title="Tolerancia de llegada"
                description="Minutos después de su hora de llegada antes de contar como llegada tarde."
                error={errors.toleranciaLlegadaNaturalMin}
              >
                <UnitInput
                  id="toleranciaLlegadaNaturalMin"
                  name="toleranciaLlegadaNaturalMin"
                  unit="minutos"
                  inputMode="numeric"
                  defaultValue={value("toleranciaLlegadaNaturalMin", String(config.toleranciaLlegadaNaturalMin))}
                  aria-invalid={Boolean(errors.toleranciaLlegadaNaturalMin) || undefined}
                  aria-describedby={describedBy("toleranciaLlegadaNaturalMin")}
                />
              </SettingRow>

              <SettingRow
                htmlFor="minHorasAntesSalidaNatural"
                title="Tiempo mínimo antes de la salida"
                description="Si un voluntario intenta marcar salida antes de este tiempo desde su entrada, el kiosko no la registra y le pide hablar con coordinación."
                error={errors.minHorasAntesSalidaNatural}
              >
                <UnitInput
                  id="minHorasAntesSalidaNatural"
                  name="minHorasAntesSalidaNatural"
                  unit="horas"
                  defaultValue={value("minHorasAntesSalidaNatural", formatHours(config.minMinutosAntesSalidaNatural))}
                  aria-invalid={Boolean(errors.minHorasAntesSalidaNatural) || undefined}
                  aria-describedby={describedBy("minHorasAntesSalidaNatural")}
                />
              </SettingRow>
            </SettingsCard>

            <SettingsCard title="Jornada">
              <SettingRow
                htmlFor="jornadaMaximaHoras"
                title="Jornada máxima por día"
                description="Evita sumar horas de más por una salida marcada al día siguiente."
                error={errors.jornadaMaximaHoras}
              >
                <UnitInput
                  id="jornadaMaximaHoras"
                  name="jornadaMaximaHoras"
                  unit="horas"
                  inputMode="numeric"
                  defaultValue={value("jornadaMaximaHoras", String(config.jornadaMaximaHoras))}
                  aria-invalid={Boolean(errors.jornadaMaximaHoras) || undefined}
                  aria-describedby={describedBy("jornadaMaximaHoras")}
                />
              </SettingRow>
            </SettingsCard>

            <SettingsCard title="Carnets virtuales">
              <SettingRow
                htmlFor="carnetsPorHora"
                title="Carnets por hora"
                description="Cuántos carnets virtuales se envían como máximo por hora. Ajústalo al límite de tu proveedor de correo."
                error={errors.carnetsPorHora}
              >
                <UnitInput
                  id="carnetsPorHora"
                  name="carnetsPorHora"
                  unit="por hora"
                  inputMode="numeric"
                  defaultValue={value("carnetsPorHora", String(config.carnetsPorHora))}
                  aria-invalid={Boolean(errors.carnetsPorHora) || undefined}
                  aria-describedby={describedBy("carnetsPorHora")}
                />
              </SettingRow>
            </SettingsCard>
          </form>

          {children}
        </div>

        {aside}
      </div>
    </>
  );
}
