/** Sedes: lugares físicos donde se practica (maqueta 4f). */

import { HHMM, minutesOf } from "@/lib/usuarios/userInput";
import { MAX_NOMBRE, cleanText } from "./nombres";

const MAX_DIRECCION = 200;

export interface SedeOpcion {
  id: number;
  nombre: string;
  direccion: string | null;
  /** Horario por defecto de sus practicantes, "HH:mm". */
  horaApertura: string | null;
  horaCierre: string | null;
  activa: boolean;
}

export interface SedeInput {
  nombre: string;
  direccion: string | null;
  horaApertura: string | null;
  horaCierre: string | null;
  activa: boolean;
}

export type SedeField = "nombre" | "direccion" | "horaApertura" | "horaCierre";
export type SedeErrors = Partial<Record<SedeField, string>>;

export function validateSedeInput(
  raw: Partial<Record<SedeField | "activa", unknown>>
): { ok: true; value: SedeInput } | { ok: false; errors: SedeErrors } {
  const errors: SedeErrors = {};

  const nombre = cleanText(raw.nombre);
  if (!nombre) errors.nombre = "Falta el nombre";
  else if (nombre.length > MAX_NOMBRE) errors.nombre = `El nombre puede tener hasta ${MAX_NOMBRE} letras`;

  const direccion = cleanText(raw.direccion);
  if (direccion.length > MAX_DIRECCION) errors.direccion = `La dirección puede tener hasta ${MAX_DIRECCION} letras`;

  const horaApertura = cleanText(raw.horaApertura) || null;
  const horaCierre = cleanText(raw.horaCierre) || null;
  if (horaApertura && !HHMM.test(horaApertura)) errors.horaApertura = "Escribe la hora como 07:00";
  if (horaCierre && !HHMM.test(horaCierre)) errors.horaCierre = "Escribe la hora como 17:00";
  if (!errors.horaApertura && !errors.horaCierre) {
    if (horaApertura && !horaCierre) errors.horaCierre = "Falta la hora de cierre";
    else if (!horaApertura && horaCierre) errors.horaApertura = "Falta la hora de apertura";
    else if (horaApertura && horaCierre && minutesOf(horaCierre) <= minutesOf(horaApertura)) {
      errors.horaCierre = "La hora de cierre debe ser después de la apertura";
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      nombre,
      direccion: direccion || null,
      horaApertura,
      horaCierre,
      activa: raw.activa !== "false" && raw.activa !== false,
    },
  };
}

/** "07:00 – 17:00" o "Sin horario" (tarjeta de sede). */
export function formatHorario(apertura: string | null, cierre: string | null): string {
  return apertura && cierre ? `${apertura} – ${cierre}` : "Sin horario";
}
