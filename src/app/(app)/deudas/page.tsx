import { redirect } from "next/navigation";
import { serializar } from "@/lib/api";
import { usuarioIdActual } from "@/lib/auth";
import { calcularCapacidadEndeudamiento } from "@/lib/calculos/capacidad-endeudamiento";
import { listarCategorias, listarCuentas } from "@/lib/consultas/basicas";
import { aNumero, convertir, redondear } from "@/lib/moneda";
import { prisma } from "@/lib/prisma";
import type { CapacidadDTO, DeudaDTO } from "@/types";
import { DeudasCliente } from "./deudas-cliente";

export const dynamic = "force-dynamic";

export default async function DeudasPage() {
  const usuarioId = await usuarioIdActual();
  if (!usuarioId) redirect("/login");

  const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
  const tasaRow = await prisma.tasaCambio.findFirst({ orderBy: { fecha: "desc" } });
  const tasa = tasaRow ? aNumero(tasaRow.valorBsPorUsd) : null;
  const ref = usuario.monedaReferenciaDefault;

  const [deudas, capacidad, cuentas, categorias] = await Promise.all([
    prisma.deudaPrestamo.findMany({
      where: { usuarioId, activa: true },
      include: { pagos: { orderBy: { fecha: "desc" } } },
      orderBy: { createdAt: "desc" },
    }),
    calcularCapacidadEndeudamiento(usuarioId),
    listarCuentas(usuarioId),
    listarCategorias(usuarioId),
  ]);

  const conv = (monto: number, moneda: typeof ref) => {
    try {
      return convertir(monto, moneda, ref, tasa);
    } catch {
      return 0;
    }
  };

  const deudaTotal = redondear(
    deudas.reduce((a, d) => a + conv(aNumero(d.saldoRestante), d.moneda), 0),
  );
  // Estimación: saldo × tasa mensual pactada. No es lo facturado, es lo que
  // costaría este mes si el saldo no se mueve.
  const interesesEstimados = redondear(
    deudas.reduce(
      (a, d) => a + conv(aNumero(d.saldoRestante), d.moneda) * aNumero(d.tasaInteresMensual),
      0,
    ),
  );

  return (
    <DeudasCliente
      deudas={serializar(deudas) as unknown as DeudaDTO[]}
      capacidad={serializar(capacidad) as unknown as CapacidadDTO}
      cuentas={cuentas.filter((c) => c.activa)}
      categorias={categorias}
      deudaTotal={deudaTotal}
      interesesEstimados={interesesEstimados}
      monedaReferencia={ref}
    />
  );
}
