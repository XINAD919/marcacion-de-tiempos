import { describe, expect, it } from "vitest";
import type { InstitucionOpcion } from "@/lib/catalogo/institucion";
import { buildCatalogIndex } from "@/lib/catalogo/nombres";
import type { SedeOpcion } from "@/lib/catalogo/sede";
import { type ImportCatalog, classifyImportRows } from "./importRows";

const instituciones: InstitucionOpcion[] = [
  { id: 1, nombre: "Universidad Nacional", tipo: "universidad", horasExigidas: 240, activa: true },
  { id: 2, nombre: "Colegio San José", tipo: "colegio", horasExigidas: 80, activa: true },
  { id: 3, nombre: "Universidad Cerrada", tipo: "universidad", horasExigidas: 240, activa: false },
];
const sedes: SedeOpcion[] = [
  { id: 10, nombre: "Sede Centro", direccion: null, horaApertura: "07:00", horaCierre: "17:00", activa: true },
  { id: 11, nombre: "Bodega Fontibón", direccion: null, horaApertura: null, horaCierre: null, activa: true },
];
const catalogo: ImportCatalog = { instituciones: buildCatalogIndex(instituciones), sedes: buildCatalogIndex(sedes) };

const header = {
  Nombre: "Laura Catalina Rodríguez",
  "Cédula": "1.019.442.881",
  Correo: "laura@unal.edu.co",
  "Institución": "Universidad Nacional",
  Sede: "Sede Centro",
  "Horas requeridas": 240,
};

function without(row: Record<string, unknown>, key: string) {
  return Object.fromEntries(Object.entries(row).filter(([name]) => name !== key));
}

const classify = (rows: Record<string, unknown>[], existentes = new Set<string>()) =>
  classifyImportRows(rows, existentes, catalogo);

describe("classifyImportRows", () => {
  it("acepta filas válidas y numera como en Excel (la fila 1 es el encabezado)", () => {
    const result = classify([header]);
    expect(result.columnasFaltantes).toEqual([]);
    expect(result.validos).toHaveLength(1);
    expect(result.validos[0]).toMatchObject({ fila: 2, input: { cedula: "1019442881", horasRequeridas: 240 } });
  });

  it("reconoce encabezados con otras mayúsculas, tildes o sinónimos", () => {
    const result = classify(
      [
        {
          "NOMBRE COMPLETO": "Andrés Mora",
          documento: 1023884112,
          "correo electrónico": "",
          colegio: "Colegio San José",
          sede: "Bodega Fontibón",
          "horas exigidas": "120",
        },
      ]);
    expect(result.validos[0]?.input).toMatchObject({
      nombre: "Andrés Mora",
      cedula: "1023884112",
      institucionId: 2,
      sedeId: 11,
    });
  });

  it("une las columnas Nombres y Apellidos", () => {
    const result = classify(
      [{ ...without(header, "Nombre"), Nombres: "Tomás", Apellidos: "Rincón" }]);
    expect(result.validos[0]?.input.nombre).toBe("Tomás Rincón");
  });

  it("separa duplicados: ya registrados y repetidos dentro del archivo", () => {
    const result = classify(
      [header, { ...header, Nombre: "Otra persona" }, { ...header, "Cédula": "52123456" }],
      new Set(["52123456"])
    );
    expect(result.validos.map((row) => row.fila)).toEqual([2]);
    expect(result.duplicados).toEqual([
      { fila: 3, nombre: "Otra persona", cedula: "1019442881", motivo: "Repetida en la fila 2" },
      { fila: 4, nombre: "Laura Catalina Rodríguez", cedula: "52123456", motivo: "Ya está registrada" },
    ]);
  });

  it("explica cada fila con error en español llano", () => {
    const result = classify(
      [
        { ...header, "Cédula": "" },
        { ...header, "Cédula": "1.0A4.221" },
        { ...header, "Horas requeridas": "muchas" },
      ]);
    expect(result.errores).toEqual([
      { fila: 2, nombre: "Laura Catalina Rodríguez", cedula: "", motivo: "Cédula vacía" },
      { fila: 3, nombre: "Laura Catalina Rodríguez", cedula: "1.0A4.221", motivo: "La cédula tiene letras" },
      { fila: 4, nombre: "Laura Catalina Rodríguez", cedula: "1.019.442.881", motivo: "Horas exigidas sin número" },
    ]);
  });

  it("ignora filas completamente vacías sin descontar la numeración", () => {
    const result = classify([header, {}, { ...header, "Cédula": "52123456" }]);
    expect(result.validos.map((row) => row.fila)).toEqual([2, 4]);
  });

  it("convierte fechas y horas de Excel (seriales, fracciones de día y Date)", () => {
    const result = classify(
      [
        { ...header, "Fecha de inicio": 46235, "Hora de inicio": 1 / 3, "Hora de fin": "12:00" },
        { ...header, "Cédula": "52123456", "Fecha de inicio": "01/08/2026", "Hora de inicio": "8:00" , "Hora de fin": "12:00:00" },
        { ...header, "Cédula": "52123457", "Fecha de inicio": new Date(2026, 7, 1) },
      ]);
    expect(result.errores).toEqual([]);
    for (const row of result.validos) {
      expect(row.input.fechaInicio).toEqual(new Date(2026, 7, 1));
    }
    expect(result.validos[0]?.input).toMatchObject({ horaInicio: "08:00", horaFin: "12:00" });
    expect(result.validos[1]?.input).toMatchObject({ horaInicio: "08:00", horaFin: "12:00" });
  });

  it("si falta una columna obligatoria no procesa filas y dice cuál falta", () => {
    const result = classify([without(header, "Cédula")]);
    expect(result.columnasFaltantes).toEqual(["Cédula"]);
    expect(result.validos).toEqual([]);
  });

  it("sin columna Tipo asume practicante", () => {
    const result = classify([header]);
    expect(result.validos[0]?.input.tipo).toBe("practicante");
  });

  it("lee la columna Tipo", () => {
    const result = classify([{ ...header, Tipo: "Colegio" }]);
    expect(result.validos[0]?.input.tipo).toBe("practicante");
  });

  it("explica un tipo que no reconoce", () => {
    const result = classify([{ ...header, Tipo: "Empresa" }]);
    expect(result.errores[0]?.motivo).toBe("El tipo debe ser Practicante o Natural");
  });

  it("un archivo solo de naturales no necesita columnas de práctica", () => {
    const result = classify(
      [{ Nombre: "Marta Gómez", "Cédula": "52123456", Tipo: "Natural", "Hora de inicio": "09:00", "Hora de fin": "13:00" }]);
    expect(result.columnasFaltantes).toEqual([]);
    expect(result.validos[0]?.input).toMatchObject({ tipo: "natural", institucionId: null, horasRequeridas: 0 });
  });

  it("en una fila natural ignora la institución y la sede escritas", () => {
    const result = classify(
      [{ ...header, Tipo: "Voluntario", "Hora de inicio": "09:00", "Hora de fin": "13:00" }]);
    expect(result.errores).toEqual([]);
    expect(result.validos[0]?.input).toMatchObject({ tipo: "natural", institucionId: null, sedeId: null });
  });

  it("una fila natural sin horario es error", () => {
    const result = classify([{ ...header, Tipo: "Natural" }]);
    expect(result.errores[0]?.motivo).toContain("Falta la hora de llegada");
  });

  it("acepta Hora de llegada y Hora de salida, como dice el formulario", () => {
    const result = classify(
      [{ Nombre: "Marta Gómez", "Cédula": "52123456", Tipo: "Natural", "Hora de llegada": "09:00", "Hora de salida": "13:00" }]);
    expect(result.validos[0]?.input).toMatchObject({ horaInicio: "09:00", horaFin: "13:00" });
  });

  it("reconoce la institución y la sede sin importar mayúsculas, tildes ni espacios", () => {
    const result = classify([{ ...header, "Institución": "  UNIVERSIDAD   nacional ", Sede: "bodega fontibon" }]);
    expect(result.errores).toEqual([]);
    expect(result.validos[0]?.input).toMatchObject({ institucionId: 1, sedeId: 11 });
  });

  it("acepta las columnas viejas Universidad / Colegio y Entidad", () => {
    const result = classify([
      { ...without(without(header, "Institución"), "Sede"), "Universidad / Colegio": "Universidad Nacional", Entidad: "Sede Centro" },
    ]);
    expect(result.columnasFaltantes).toEqual([]);
    expect(result.validos[0]?.input).toMatchObject({ institucionId: 1, sedeId: 10 });
  });

  it("no crea instituciones ni sedes: explica cuál no existe o está inactiva", () => {
    const result = classify([
      { ...header, "Institución": "U. Nacional" },
      { ...header, "Cédula": "52123456", "Institución": "Universidad Cerrada", Sede: "Sede Norte" },
    ]);
    expect(result.validos).toEqual([]);
    expect(result.errores.map((error) => error.motivo)).toEqual([
      "La institución «U. Nacional» no existe. Agrégala en Instituciones y sedes o corrige el nombre.",
      "La institución «Universidad Cerrada» está inactiva.; La sede «Sede Norte» no existe. Agrégala en Instituciones y sedes o corrige el nombre.",
    ]);
  });

  it("sin horas ni horario toma los de la institución y la sede", () => {
    const result = classify([without(header, "Horas requeridas")]);
    expect(result.validos[0]?.input).toMatchObject({ horasRequeridas: 240, horaInicio: "07:00", horaFin: "17:00" });
  });

  it("lo escrito en el Excel gana a lo de la institución y la sede", () => {
    const result = classify([{ ...header, "Horas requeridas": 300, "Hora de inicio": "08:00", "Hora de fin": "12:00" }]);
    expect(result.validos[0]?.input).toMatchObject({ horasRequeridas: 300, horaInicio: "08:00", horaFin: "12:00" });
  });
});
