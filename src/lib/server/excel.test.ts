import { describe, expect, it } from "vitest";
import { buildWorkbook, readSheetRows } from "./excel";

const CSV = "Nombre,Cédula,Universidad / Colegio\nLaura Rodríguez,1019442881,Universidad Nacional\n";

function bytes(data: Uint8Array | Buffer): ArrayBuffer {
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
}

/** Windows-1252 para el rango que usa el español (Latin-1 coincide ahí). */
function windows1252(text: string): Uint8Array {
  return Uint8Array.from(text, (char) => char.charCodeAt(0));
}

const expected = [{ Nombre: "Laura Rodríguez", "Cédula": 1019442881, "Universidad / Colegio": "Universidad Nacional" }];

describe("readSheetRows", () => {
  it("lee un CSV en UTF-8 conservando las tildes", () => {
    const rows = readSheetRows(bytes(new TextEncoder().encode(CSV)));
    expect(rows).toEqual([expect.objectContaining({ Nombre: "Laura Rodríguez", "Cédula": expect.anything() })]);
  });

  it("lee el 'CSV UTF-8' de Excel (con BOM al inicio)", () => {
    const rows = readSheetRows(bytes(new TextEncoder().encode(`﻿${CSV}`)));
    expect(Object.keys(rows[0]!)).toContain("Nombre");
    expect(rows[0]!["Nombre"]).toBe("Laura Rodríguez");
  });

  it("lee el CSV de Excel en español: Windows-1252 y separado por punto y coma", () => {
    const rows = readSheetRows(bytes(windows1252(CSV.replaceAll(",", ";"))));
    expect(rows[0]).toMatchObject({ Nombre: "Laura Rodríguez" });
    expect(Object.keys(rows[0]!)).toContain("Cédula");
  });

  it("lee un .xlsx", () => {
    const rows = readSheetRows(bytes(buildWorkbook(expected, "Hoja")));
    expect(rows).toEqual(expected);
  });
});
