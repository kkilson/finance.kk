import { describe, expect, it } from "vitest";
import {
  mapearFilas,
  parsearFecha,
  parsearMoneda,
  parsearMonto,
  parsearTipo,
  sugerirMapeo,
  type Mapeo,
  type OpcionesImportacion,
} from "./importacion";

const OPCIONES: OpcionesImportacion = {
  tipoPorDefecto: "GASTO",
  monedaPorDefecto: "BS",
  signoDefineTipo: true,
  formatoLatino: true,
};

describe("parsearMonto", () => {
  it("entiende el formato latino", () => {
    expect(parsearMonto("1.234,56", true)).toBe(1234.56);
    expect(parsearMonto("-2.000,00", true)).toBe(-2000);
  });

  it("entiende el formato anglosajón", () => {
    expect(parsearMonto("1,234.56", false)).toBe(1234.56);
  });

  it("ignora símbolos de moneda y espacios", () => {
    expect(parsearMonto("Bs 1.500,00", true)).toBe(1500);
    expect(parsearMonto("$ 45.30", false)).toBe(45.3);
  });

  it("en modo latino, un punto con 1-2 decimales sigue siendo decimal", () => {
    // Los XLSX entregan el número ya formateado con punto: "-80.5" son 80,5.
    expect(parsearMonto("-80.5", true)).toBe(-80.5);
    expect(parsearMonto("12.75", true)).toBe(12.75);
  });

  it("en modo latino, un punto con 3 dígitos sí agrupa miles", () => {
    expect(parsearMonto("1.500", true)).toBe(1500);
    expect(parsearMonto("1.234.567", true)).toBe(1234567);
  });

  it("devuelve null si no hay número", () => {
    expect(parsearMonto("", true)).toBeNull();
    expect(parsearMonto("n/a", true)).toBeNull();
  });
});

describe("parsearFecha", () => {
  it("acepta dd/mm/yyyy", () => {
    const f = parsearFecha("16/08/2026")!;
    expect([f.getFullYear(), f.getMonth(), f.getDate()]).toEqual([2026, 7, 16]);
  });

  it("acepta dd-mm-yy", () => {
    const f = parsearFecha("05-01-26")!;
    expect([f.getFullYear(), f.getMonth(), f.getDate()]).toEqual([2026, 0, 5]);
  });

  it("acepta ISO", () => {
    expect(parsearFecha("2026-08-16")).toBeInstanceOf(Date);
  });

  it("rechaza basura", () => {
    expect(parsearFecha("ayer")).toBeNull();
    expect(parsearFecha("")).toBeNull();
  });
});

describe("parsearTipo y parsearMoneda", () => {
  it("reconoce los sinónimos que usan los bancos", () => {
    expect(parsearTipo("Débito")).toBe("GASTO");
    expect(parsearTipo("CRÉDITO")).toBe("INGRESO");
    expect(parsearTipo("otra cosa")).toBeNull();
  });

  it("reconoce las dos monedas", () => {
    expect(parsearMoneda("Bs")).toBe("BS");
    expect(parsearMoneda("dólares")).toBe("USD");
    expect(parsearMoneda("euros")).toBeNull();
  });
});

describe("mapearFilas", () => {
  const mapeo: Mapeo = { fecha: "Fecha", monto: "Monto" };

  it("convierte filas válidas", () => {
    const { movimientos, errores } = mapearFilas(
      [
        { Fecha: "16/08/2026", Monto: "-1.500,00" },
        { Fecha: "17/08/2026", Monto: "2.000,00" },
      ],
      mapeo,
      OPCIONES,
    );
    expect(errores).toHaveLength(0);
    expect(movimientos.map((m) => [m.tipo, m.monto])).toEqual([
      ["GASTO", 1500],
      ["INGRESO", 2000],
    ]);
  });

  it("numera las filas como en el archivo, contando el encabezado", () => {
    const { errores } = mapearFilas([{ Fecha: "xx", Monto: "10" }], mapeo, OPCIONES);
    expect(errores[0].fila).toBe(2);
  });

  it("salta filas vacías sin contarlas como error", () => {
    const { movimientos, errores } = mapearFilas(
      [{ Fecha: "", Monto: "" }, { Fecha: "16/08/2026", Monto: "10" }],
      mapeo,
      OPCIONES,
    );
    expect(movimientos).toHaveLength(1);
    expect(errores).toHaveLength(0);
  });

  it("reporta fecha y monto ilegibles", () => {
    const { movimientos, errores } = mapearFilas(
      [
        { Fecha: "no es fecha", Monto: "10" },
        { Fecha: "16/08/2026", Monto: "cero" },
      ],
      mapeo,
      OPCIONES,
    );
    expect(movimientos).toHaveLength(0);
    expect(errores.map((e) => e.motivo)).toEqual(["Fecha ilegible", "Monto ilegible o cero"]);
  });

  it("la columna de tipo gana sobre el signo del monto", () => {
    const { movimientos } = mapearFilas(
      [{ Fecha: "16/08/2026", Monto: "-100", Tipo: "Crédito" }],
      { ...mapeo, tipo: "Tipo" },
      OPCIONES,
    );
    expect(movimientos[0].tipo).toBe("INGRESO");
    expect(movimientos[0].monto).toBe(100);
  });

  it("sin columna de tipo ni signo, cae al tipo por defecto", () => {
    const { movimientos } = mapearFilas(
      [{ Fecha: "16/08/2026", Monto: "100" }],
      mapeo,
      { ...OPCIONES, signoDefineTipo: false, tipoPorDefecto: "GASTO" },
    );
    expect(movimientos[0].tipo).toBe("GASTO");
  });

  it("arrastra categoría, cuenta y nota cuando están mapeadas", () => {
    const { movimientos } = mapearFilas(
      [{ Fecha: "16/08/2026", Monto: "100", Cat: "Mercado", Cta: "Mercantil", Desc: "compra" }],
      { ...mapeo, categoria: "Cat", cuenta: "Cta", nota: "Desc" },
      OPCIONES,
    );
    expect(movimientos[0]).toMatchObject({
      nombreCategoria: "Mercado",
      nombreCuenta: "Mercantil",
      nota: "compra",
    });
  });
});

describe("sugerirMapeo", () => {
  it("adivina las columnas típicas sin importar acentos ni mayúsculas", () => {
    expect(
      sugerirMapeo(["FECHA", "Descripción", "Monto Bs", "Categoría", "Cuenta"]),
    ).toMatchObject({
      fecha: "FECHA",
      monto: "Monto Bs",
      categoria: "Categoría",
      cuenta: "Cuenta",
      nota: "Descripción",
    });
  });

  it("deja sin sugerir lo que no reconoce", () => {
    expect(sugerirMapeo(["col1", "col2"]).fecha).toBeUndefined();
  });
});
