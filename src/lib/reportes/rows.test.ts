import { describe, expect, it } from "vitest";
import { buildReporteRow, sortByNombre, summarize, type ReporteUser } from "./rows";

const HOUR = 60 * 60 * 1000;
const at = (hhmm: string, day = "2026-09-14") => new Date(`${day}T${hhmm}:00`);

const user: ReporteUser = {
  id: "u1",
  nombre: "Laura Rodríguez",
  cedula: "1019442881",
  universidad: "Universidad Nacional",
  entidad: "Sede Centro",
  activo: true,
  horasRequeridas: 240,
};

describe("buildReporteRow", () => {
  it("suma los pares ENTRADA → SALIDA y deriva avance, restantes y estado", () => {
    const row = buildReporteRow(
      user,
      [
        { tipo: "IN", marcadoEn: at("08:00") },
        { tipo: "OUT", marcadoEn: at("12:00") },
        { tipo: "IN", marcadoEn: at("08:00", "2026-09-15") },
        { tipo: "OUT", marcadoEn: at("12:00", "2026-09-15") },
      ],
      {}
    );
    expect(row.workedMs).toBe(8 * HOUR);
    expect(row.remainingMs).toBe(232 * HOUR);
    expect(row.percent).toBe(3);
    expect(row.estado).toBe("en-curso");
  });

  it("aplica la jornada máxima por día igual que el kiosko", () => {
    const row = buildReporteRow(
      user,
      [
        { tipo: "IN", marcadoEn: at("08:00") },
        { tipo: "OUT", marcadoEn: at("07:00", "2026-09-15") },
      ],
      { maxDailyMs: 9 * HOUR }
    );
    expect(row.workedMs).toBe(9 * HOUR);
  });

  it("la última marcación es la más reciente, llegue en el orden que llegue", () => {
    const row = buildReporteRow(
      user,
      [
        { tipo: "OUT", marcadoEn: at("12:00") },
        { tipo: "IN", marcadoEn: at("08:00") },
        { tipo: "IN", marcadoEn: at("08:00", "2026-09-16") },
      ],
      {}
    );
    expect(row.ultimaMarcacion).toEqual({ en: at("08:00", "2026-09-16"), tipo: "IN" });
  });

  it("sin marcaciones: cero horas y sin última marcación", () => {
    const row = buildReporteRow(user, [], {});
    expect(row.workedMs).toBe(0);
    expect(row.percent).toBe(0);
    expect(row.ultimaMarcacion).toBeNull();
  });

  it("una entrada abierta no suma, pero sí cuenta como última marcación", () => {
    const row = buildReporteRow(user, [{ tipo: "IN", marcadoEn: at("08:00") }], {});
    expect(row.workedMs).toBe(0);
    expect(row.ultimaMarcacion?.tipo).toBe("IN");
  });
});

describe("summarize", () => {
  const row = (estado: "en-curso" | "por-finalizar" | "completado" | "inactivo", workedMs: number) =>
    ({ ...user, workedMs, remainingMs: null, percent: null, estado, ultimaMarcacion: null }) as const;

  it("cuenta cada estado y acumula las horas", () => {
    const summary = summarize([
      row("en-curso", 10 * HOUR),
      row("en-curso", 5 * HOUR),
      row("por-finalizar", 95 * HOUR),
      row("completado", 100 * HOUR),
      row("inactivo", 2 * HOUR),
    ]);
    expect(summary).toEqual({
      total: 5,
      enCurso: 2,
      porFinalizar: 1,
      completados: 1,
      inactivos: 1,
      workedMs: 212 * HOUR,
    });
  });

  it("con una lista vacía devuelve ceros", () => {
    expect(summarize([]).total).toBe(0);
  });
});

describe("sortByNombre", () => {
  it("ordena en español y no modifica el arreglo original", () => {
    const rows = ["Beto", "Álvaro", "Carla"].map(
      (nombre) =>
        ({ ...user, nombre, workedMs: 0, remainingMs: null, percent: null, estado: "en-curso", ultimaMarcacion: null }) as const
    );
    const sorted = sortByNombre([...rows]);
    expect(sorted.map((r) => r.nombre)).toEqual(["Álvaro", "Beto", "Carla"]);
    expect(rows.map((r) => r.nombre)).toEqual(["Beto", "Álvaro", "Carla"]);
  });
});
