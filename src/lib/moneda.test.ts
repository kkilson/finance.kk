import { describe, expect, it } from "vitest";
import { convertir, redondear, SinTasaError } from "./moneda";

describe("convertir", () => {
  it("no toca el monto si la moneda no cambia, aun sin tasa", () => {
    expect(convertir(100, "USD", "USD", null)).toBe(100);
    expect(convertir(100, "BS", "BS", null)).toBe(100);
  });

  it("convierte en ambos sentidos", () => {
    expect(convertir(3600, "BS", "USD", 36)).toBe(100);
    expect(convertir(100, "USD", "BS", 36)).toBe(3600);
  });

  it("es reversible", () => {
    expect(redondear(convertir(convertir(250, "USD", "BS", 41.37), "BS", "USD", 41.37))).toBe(250);
  });

  it("falla explícitamente si hace falta tasa y no hay", () => {
    expect(() => convertir(100, "BS", "USD", null)).toThrow(SinTasaError);
    expect(() => convertir(100, "BS", "USD", 0)).toThrow(SinTasaError);
  });
});

describe("redondear", () => {
  it("redondea a 2 decimales por defecto", () => {
    expect(redondear(10.005)).toBe(10.01);
    expect(redondear(1 / 3)).toBe(0.33);
  });
});
