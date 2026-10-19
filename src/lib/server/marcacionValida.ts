import type { Prisma } from "@prisma/client";

/** Filtro de marcaciones que cuentan: las anuladas se conservan, pero no suman. */
export const MARCACION_VALIDA = { anuladaEn: null } as const satisfies Prisma.AttendanceLogWhereInput;

/** `deviceId` de las marcaciones que registra coordinación a mano. */
export const DEVICE_COORDINACION = "coordinacion";
