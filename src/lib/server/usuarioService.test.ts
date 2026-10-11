import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { UsuarioInput } from "@/lib/usuarios/userInput";
import { guardarInstitucion, guardarSede } from "./catalogoService";
import { descriptorToBuffer } from "./faceMatcher";
import { prisma } from "./prisma";
import { createUsuario, dbDateToIso, insertUsuarios, listCedulas, listUsuarios, updateUsuario } from "./usuarioService";

// Prefijo propio para no chocar con datos reales del entorno de desarrollo.
const PREFIX = "990077";
const INSTITUCION = "Zz Universidad de Prueba Servicio";
const SEDE = "Zz Sede de Prueba Servicio";
let institucionId: number;
let sedeId: number;

function input(overrides: Partial<UsuarioInput>): UsuarioInput {
  return {
    tipo: "universidad",
    nombre: "Sin Nombre",
    cedula: `${PREFIX}000`,
    email: null,
    universidad: INSTITUCION,
    entidad: "Entidad Prueba",
    horasRequeridas: 240,
    fechaInicio: null,
    horaInicio: null,
    horaFin: null,
    activo: true,
    ...overrides,
  };
}

async function cleanup() {
  const users = await prisma.user.findMany({ where: { cedula: { startsWith: PREFIX } }, select: { id: true } });
  const ids = users.map((user) => user.id);
  await prisma.faceEmbedding.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.institucion.deleteMany({ where: { nombre: INSTITUCION } });
  await prisma.sede.deleteMany({ where: { nombre: SEDE } });
}

beforeAll(async () => {
  await cleanup();
  const institucion = await guardarInstitucion(null, { nombre: INSTITUCION, tipo: "colegio", horasExigidas: 80, activa: true });
  const sede = await guardarSede(null, { nombre: SEDE, direccion: null, horaApertura: null, horaCierre: null, activa: true });
  if (!institucion.ok || !sede.ok) throw new Error("No se pudo crear el catálogo de prueba");
  institucionId = institucion.id;
  sedeId = sede.id;
  await insertUsuarios([
    input({ nombre: "Ana Prueba Activa", cedula: `${PREFIX}001` }),
    input({ nombre: "Beto Prueba Inactivo", cedula: `${PREFIX}002`, activo: false }),
    input({ nombre: "Carla Prueba Con Rostro", cedula: `${PREFIX}003` }),
    input({
      nombre: "Dora Prueba Natural",
      cedula: `${PREFIX}004`,
      tipo: "natural",
      universidad: null,
      entidad: null,
      horasRequeridas: 0,
    }),
  ]);
  await prisma.user.updateMany({
    where: { cedula: { startsWith: PREFIX }, tipo: { not: "natural" } },
    data: { institucionId, sedeId },
  });
  const carla = await prisma.user.findUniqueOrThrow({ where: { cedula: `${PREFIX}003` } });
  await prisma.faceEmbedding.create({
    data: { userId: carla.id, embedding: descriptorToBuffer(new Float32Array(128)), modelo: "test" },
  });
});

afterAll(cleanup);

describe("listUsuarios", () => {
  const names = async (filters: Parameters<typeof listUsuarios>[0]) =>
    (await listUsuarios({ institucion: institucionId, ...filters })).rows.map((row) => row.nombre);

  it("filtra por estado; 'sin rostro' son activos sin fotos", async () => {
    expect(await names({ estado: "activo" })).toEqual(["Ana Prueba Activa", "Carla Prueba Con Rostro"]);
    expect(await names({ estado: "inactivo" })).toEqual(["Beto Prueba Inactivo"]);
    expect(await names({ estado: "sin-rostro" })).toEqual(["Ana Prueba Activa"]);
  });

  it("filtra por tipo: natural por el usuario, el resto por su institución", async () => {
    const naturales = await listUsuarios({ q: "Dora Prueba Natural", tipo: "natural" });
    expect(naturales.rows.map((row) => [row.nombre, row.institucion, row.sede])).toEqual([["Dora Prueba Natural", null, null]]);
    expect((await listUsuarios({ q: "Dora Prueba Natural", tipo: "colegio" })).rows).toEqual([]);
    expect(await names({ tipo: "colegio", estado: "activo" })).toEqual(["Ana Prueba Activa", "Carla Prueba Con Rostro"]);
    expect(await names({ tipo: "universidad" })).toEqual([]);
  });

  it("filtra por sede y trae los nombres del catálogo", async () => {
    const { rows } = await listUsuarios({ sede: sedeId, q: "Ana Prueba" });
    expect(rows.map((row) => [row.institucion, row.institucionTipo, row.sede])).toEqual([[INSTITUCION, "colegio", SEDE]]);
  });

  it("busca por nombre sin distinguir mayúsculas, y por cédula escrita con puntos", async () => {
    expect(await names({ q: "carla" })).toEqual(["Carla Prueba Con Rostro"]);
    expect(await names({ q: "990.077.002" })).toEqual(["Beto Prueba Inactivo"]);
  });

  it("cuenta las fotos de cada usuario", async () => {
    const { rows } = await listUsuarios({ institucion: institucionId, q: "carla" });
    expect(rows[0]?.fotos).toBe(1);
  });
});

describe("createUsuario / updateUsuario", () => {
  it("no permite una cédula ya registrada y dice a nombre de quién está", async () => {
    const result = await createUsuario(input({ cedula: `${PREFIX}001` }));
    expect(result).toMatchObject({ ok: false, duplicate: { nombre: "Ana Prueba Activa" } });
  });

  it("al editar, conservar la propia cédula no es duplicado", async () => {
    const ana = await prisma.user.findUniqueOrThrow({ where: { cedula: `${PREFIX}001` } });
    const result = await updateUsuario(ana.id, input({ nombre: "Ana Prueba Editada", cedula: `${PREFIX}001` }));
    expect(result).toEqual({ ok: true, id: ana.id });
  });

  it("al editar, tomar la cédula de otra persona sí es duplicado", async () => {
    const ana = await prisma.user.findUniqueOrThrow({ where: { cedula: `${PREFIX}001` } });
    const result = await updateUsuario(ana.id, input({ cedula: `${PREFIX}002` }));
    expect(result).toMatchObject({ ok: false, duplicate: { nombre: "Beto Prueba Inactivo" } });
  });
});

describe("fechaInicio (columna DATE)", () => {
  it("se guarda y se lee como el mismo día, sin correrse por zona horaria", async () => {
    const result = await createUsuario(input({ cedula: `${PREFIX}010`, fechaInicio: new Date(2026, 7, 1) }));
    expect(result.ok).toBe(true);
    const saved = await prisma.user.findUniqueOrThrow({ where: { cedula: `${PREFIX}010` } });
    expect(dbDateToIso(saved.fechaInicio)).toBe("2026-08-01");
  });
});

describe("listCedulas", () => {
  it("devuelve solo las cédulas que ya existen", async () => {
    expect(await listCedulas([`${PREFIX}001`, `${PREFIX}999`])).toEqual(new Set([`${PREFIX}001`]));
  });
});

describe("insertUsuarios", () => {
  it("inserta importaciones grandes sin pasar el límite de parámetros de SQL Server", async () => {
    const inputs = Array.from({ length: 200 }, (_, i) =>
      input({ nombre: `Lote ${i}`, cedula: `${PREFIX}5${String(i).padStart(3, "0")}` })
    );
    expect(await insertUsuarios(inputs)).toBe(200);
  }, 20000);
});
