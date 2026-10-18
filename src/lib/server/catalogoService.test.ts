import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { guardarInstitucion, guardarSede, listCatalogo, listCatalogoConConteos } from "./catalogoService";
import { prisma } from "./prisma";

// Prefijos propios para no chocar con datos reales del entorno de desarrollo.
const NOMBRE = "Zz Prueba Catálogo";
const CEDULA = "990055";

async function cleanup() {
  await prisma.user.deleteMany({ where: { cedula: { startsWith: CEDULA } } });
  await prisma.institucion.deleteMany({ where: { nombre: { startsWith: NOMBRE } } });
  await prisma.sede.deleteMany({ where: { nombre: { startsWith: NOMBRE } } });
}

beforeAll(cleanup);
afterAll(cleanup);

describe("guardarInstitucion", () => {
  it("crea, edita y rechaza un nombre repetido aunque cambien las mayúsculas", async () => {
    const creada = await guardarInstitucion(null, {
      nombre: `${NOMBRE} Universidad`,
      tipo: "universidad",
      horasExigidas: 240,
      activa: true,
    });
    expect(creada.ok).toBe(true);
    if (!creada.ok) return;

    const editada = await guardarInstitucion(creada.id, {
      nombre: `${NOMBRE} Universidad`,
      tipo: "tecnica",
      horasExigidas: 320,
      activa: false,
    });
    expect(editada).toEqual({ ok: true, id: creada.id });

    const repetida = await guardarInstitucion(null, {
      nombre: `${NOMBRE} UNIVERSIDAD`.toLowerCase(),
      tipo: "colegio",
      horasExigidas: 80,
      activa: true,
    });
    expect(repetida).toEqual({ ok: false, reason: "duplicado" });
  });

  it("rechaza un nombre que solo cambia en tildes o espacios internos", async () => {
    const original = await guardarInstitucion(null, {
      nombre: `${NOMBRE} Antioquia`,
      tipo: "universidad",
      horasExigidas: 240,
      activa: true,
    });
    expect(original.ok).toBe(true);
    if (!original.ok) return;

    for (const nombre of [`${NOMBRE} Antioquía`, `${NOMBRE}  Antioquia`]) {
      expect(await guardarInstitucion(null, { nombre, tipo: "universidad", horasExigidas: 240, activa: true })).toEqual({
        ok: false,
        reason: "duplicado",
      });
    }
    // Editar la misma conservando su nombre no es duplicado.
    expect(
      await guardarInstitucion(original.id, { nombre: `${NOMBRE} Antioquia`, tipo: "colegio", horasExigidas: 80, activa: true })
    ).toEqual({ ok: true, id: original.id });

    await guardarSede(null, { nombre: `${NOMBRE} Bodega Fontibón`, direccion: null, horaApertura: null, horaCierre: null, activa: true });
    expect(
      await guardarSede(null, { nombre: `${NOMBRE} Bodega Fontibon`, direccion: null, horaApertura: null, horaCierre: null, activa: true })
    ).toEqual({ ok: false, reason: "duplicado" });
    // La prueba de orden de sedes cuenta las que empiezan con NOMBRE.
    await prisma.sede.deleteMany({ where: { nombre: `${NOMBRE} Bodega Fontibón` } });
  });

  it("avisa si la que se edita ya no existe", async () => {
    expect(
      await guardarInstitucion(999_999_999, { nombre: `${NOMBRE} Fantasma`, tipo: "colegio", horasExigidas: 80, activa: true })
    ).toEqual({ ok: false, reason: "no-encontrado" });
  });
});

describe("listCatalogo / listCatalogoConConteos", () => {
  it("activas primero y cuenta solo usuarios activos", async () => {
    const sede = await guardarSede(null, {
      nombre: `${NOMBRE} Sede`,
      direccion: "Cra. 13 # 24-50",
      horaApertura: "07:00",
      horaCierre: "17:00",
      activa: true,
    });
    const inactiva = await guardarSede(null, {
      nombre: `${NOMBRE} Aaa Sede Cerrada`,
      direccion: null,
      horaApertura: null,
      horaCierre: null,
      activa: false,
    });
    expect(sede.ok && inactiva.ok).toBe(true);
    if (!sede.ok || !inactiva.ok) return;

    await prisma.user.createMany({
      data: [
        { cedula: `${CEDULA}001`, nombre: "Activa Catálogo", sedeId: sede.id },
        { cedula: `${CEDULA}002`, nombre: "Inactiva Catálogo", sedeId: sede.id, activo: false },
      ],
    });

    const { sedes } = await listCatalogo();
    const nuestras = sedes.filter((item) => item.nombre.startsWith(NOMBRE)).map((item) => item.nombre);
    // "Aaa…" va antes por nombre, pero está inactiva: va al final.
    expect(nuestras).toEqual([`${NOMBRE} Sede`, `${NOMBRE} Aaa Sede Cerrada`]);

    const conConteos = await listCatalogoConConteos();
    expect(conConteos.sedes.find((item) => item.id === sede.id)).toMatchObject({
      practicantes: 1,
      direccion: "Cra. 13 # 24-50",
      horaApertura: "07:00",
    });
    expect(conConteos.sedes.find((item) => item.id === inactiva.id)?.practicantes).toBe(0);
  });
});
