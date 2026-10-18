/**
 * Validación de practicantes, compartida por el formulario 4c y la
 * importación desde Excel 2b. Sin dependencias de servidor. Los mensajes van
 * directo a la coordinadora: español llano, sin códigos.
 */

import { type TipoUsuario, isTipoUsuario } from "./tipoUsuario";

export interface UsuarioInput {
  tipo: TipoUsuario;
  nombre: string;
  cedula: string;
  email: string | null;
  /** IDs del catálogo (maqueta 4f); null para voluntarios naturales. */
  institucionId: number | null;
  sedeId: number | null;
  /** 0 para voluntarios naturales: no tienen meta. */
  horasRequeridas: number;
  fechaInicio: Date | null;
  horaInicio: string | null;
  horaFin: string | null;
  activo: boolean;
}

export type UsuarioField =
  | "tipo"
  | "nombre"
  | "cedula"
  | "email"
  | "institucionId"
  | "sedeId"
  | "horasRequeridas"
  | "fechaInicio"
  | "horaInicio"
  | "horaFin";

export type UsuarioErrors = Partial<Record<UsuarioField, string>>;

export type ValidationResult =
  | { ok: true; value: UsuarioInput }
  | { ok: false; errors: UsuarioErrors };

export const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_CEDULA_DIGITS = 5;

function clean(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
}

/** ID del catálogo: entero positivo, o null. Llega como texto del formulario o número del Excel. */
function parseId(raw: unknown): number | null {
  const text = typeof raw === "number" ? String(raw) : clean(raw);
  const id = Number(text);
  return text && Number.isInteger(id) && id > 0 ? id : null;
}

export function normalizeCedula(raw: unknown): { ok: true; value: string } | { ok: false; error: string } {
  const value = clean(raw).replace(/[.\s-]/g, "");
  if (value === "") return { ok: false, error: "Cédula vacía" };
  if (!/^\d+$/.test(value)) return { ok: false, error: "La cédula tiene letras" };
  if (value.length < MIN_CEDULA_DIGITS) return { ok: false, error: "La cédula es muy corta" };
  return { ok: true, value };
}

/** "1019442881" → "1.019.442.881" */
export function formatCedula(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** "2026-08-01" → fecha local, o null si no existe (p. ej. 30 de febrero). */
export function parseIsoDate(raw: string): Date | null {
  const match = ISO_DATE.exec(raw);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

export function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h! * 60 + m!;
}

export function validateUsuarioInput(
  raw: Partial<Record<UsuarioField | "activo", unknown>>,
  { requireFechaInicio = true }: { requireFechaInicio?: boolean } = {}
): ValidationResult {
  const errors: UsuarioErrors = {};

  const tipoRaw = clean(raw.tipo);
  if (!isTipoUsuario(tipoRaw)) errors.tipo = "Elige el tipo de usuario.";
  // Sin tipo válido se valida como practicante: es lo más exigente.
  const tipo: TipoUsuario = isTipoUsuario(tipoRaw) ? tipoRaw : "practicante";
  const esNatural = tipo === "natural";

  const nombre = clean(raw.nombre);
  if (!nombre) errors.nombre = "Falta el nombre";

  const cedula = normalizeCedula(raw.cedula);
  if (!cedula.ok) errors.cedula = cedula.error;

  const email = clean(raw.email);
  if (email && !EMAIL.test(email)) errors.email = "El correo no parece válido";

  // Los naturales no tienen práctica: lo que llegue en estos campos se descarta.
  let institucionId: number | null = null;
  let sedeId: number | null = null;
  let horas = 0;
  let fechaInicio: Date | null = null;

  if (!esNatural) {
    institucionId = parseId(raw.institucionId);
    if (institucionId === null) errors.institucionId = "Falta la institución";

    sedeId = parseId(raw.sedeId);
    if (sedeId === null) errors.sedeId = "Falta la sede";

    const horasRaw = clean(raw.horasRequeridas);
    horas = Number(horasRaw.replace(",", "."));
    if (!horasRaw) errors.horasRequeridas = "Faltan las horas requeridas";
    else if (!Number.isFinite(horas)) errors.horasRequeridas = "Horas exigidas sin número";
    else if (!Number.isInteger(horas) || horas <= 0 || horas > 5000) {
      errors.horasRequeridas = "Las horas deben ser un número entero entre 1 y 5000";
    }

    const fechaRaw = clean(raw.fechaInicio);
    if (fechaRaw) {
      fechaInicio = parseIsoDate(fechaRaw);
      if (!fechaInicio) errors.fechaInicio = "La fecha de inicio no es válida";
    } else if (requireFechaInicio) {
      errors.fechaInicio = "Falta la fecha de inicio";
    }
  }

  const horaInicio = clean(raw.horaInicio) || null;
  const horaFin = clean(raw.horaFin) || null;
  if (horaInicio && !HHMM.test(horaInicio)) errors.horaInicio = "Escribe la hora como 08:00";
  if (horaFin && !HHMM.test(horaFin)) errors.horaFin = "Escribe la hora como 12:00";
  if (!errors.horaInicio && !errors.horaFin) {
    if (esNatural && !horaInicio) errors.horaInicio = "Falta la hora de llegada";
    if (esNatural && !horaFin) errors.horaFin = "Falta la hora de salida";
    if (!esNatural && horaInicio && !horaFin) errors.horaFin = "Falta la hora de fin del horario";
    else if (!esNatural && !horaInicio && horaFin) errors.horaInicio = "Falta la hora de inicio del horario";
    else if (horaInicio && horaFin && minutesOf(horaFin) <= minutesOf(horaInicio)) {
      errors.horaFin = esNatural
        ? "La hora de salida debe ser después de la llegada"
        : "La hora de fin debe ser después del inicio";
    }
  }

  if (Object.keys(errors).length > 0 || !cedula.ok) return { ok: false, errors };

  return {
    ok: true,
    value: {
      tipo,
      nombre,
      cedula: cedula.value,
      email: email || null,
      institucionId,
      sedeId,
      horasRequeridas: horas,
      fechaInicio,
      horaInicio,
      horaFin,
      activo: raw.activo !== "false" && raw.activo !== false,
    },
  };
}

/**
 * Fecha estimada de fin: días hábiles (lunes a viernes) desde `fechaInicio`
 * al ritmo del horario asignado. No descuenta festivos. Null si falta el
 * horario o las horas.
 */
export function estimateEndDate(
  fechaInicio: Date,
  horasRequeridas: number,
  horaInicio: string | null,
  horaFin: string | null
): Date | null {
  if (!horaInicio || !horaFin || !HHMM.test(horaInicio) || !HHMM.test(horaFin) || horasRequeridas <= 0) {
    return null;
  }
  const hoursPerDay = (minutesOf(horaFin) - minutesOf(horaInicio)) / 60;
  if (hoursPerDay <= 0) return null;

  let daysLeft = Math.ceil(horasRequeridas / hoursPerDay);
  const date = new Date(fechaInicio.getFullYear(), fechaInicio.getMonth(), fechaInicio.getDate());
  for (;;) {
    const weekday = date.getDay();
    if (weekday !== 0 && weekday !== 6) {
      daysLeft -= 1;
      if (daysLeft === 0) return date;
    }
    date.setDate(date.getDate() + 1);
  }
}
