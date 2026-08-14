import Link from "next/link";
import { differenceInCalendarDays } from "date-fns";
import { redirect } from "next/navigation";
import { usuarioIdActual } from "@/lib/auth";
import { calcularCapacidadEndeudamiento } from "@/lib/calculos/capacidad-endeudamiento";
import { calcularDiasCobertura } from "@/lib/calculos/dias-cobertura";
import { obtenerResumenDashboard } from "@/lib/consultas/dashboard";
import { aNumero, formatearMonto, SinTasaError } from "@/lib/moneda";
import { mesPeriodoDe } from "@/lib/periodo";
import { prisma } from "@/lib/prisma";
import { nombreMes } from "@/lib/formato";
import { ChartCategorias, ChartTendencia } from "@/components/dashboard/chart-categorias";
import { GaugeCobertura } from "@/components/dashboard/gauge-cobertura";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Aviso, BotonEnlace, CabeceraTarjeta, Pill, Tarjeta, Vacio } from "@/components/ui";

export const dynamic = "force-dynamic";

const COLORES_BARRA = ["#2D8CFF", "#14508F", "#5AC8B0", "#E5484D", "#8B7BD8"];

export default async function DashboardPage() {
  const usuarioId = await usuarioIdActual();
  if (!usuarioId) redirect("/login");

  const hoy = new Date();
  const resumen = await obtenerResumenDashboard(usuarioId, hoy);
  const m = resumen.monedaReferencia;
  const fmt = (n: number) => formatearMonto(n, m);

  let cobertura = null;
  let faltaTasa = false;
  try {
    cobertura = await calcularDiasCobertura(usuarioId, hoy);
  } catch (e) {
    if (e instanceof SinTasaError) faltaTasa = true;
    else throw e;
  }

  const capacidad = await calcularCapacidadEndeudamiento(usuarioId, hoy);

  // Sin cuentas el dashboard son puros ceros; mejor decir qué hacer.
  const sinCuentas = resumen.balancePorMoneda.length === 0;

  // Avisos: lo que vence pronto y las tarjetas cerca del límite.
  const [proximos, tarjetas] = await Promise.all([
    prisma.compromisoPresupuesto.findMany({
      where: {
        usuarioId,
        tipo: "PAGO",
        estado: { in: ["PENDIENTE", "ATRASADO"] },
        mesPeriodo: mesPeriodoDe(hoy),
      },
      orderBy: { fechaEsperada: "asc" },
      take: 3,
      include: { categoria: true },
    }),
    prisma.deudaPrestamo.findMany({
      where: { usuarioId, activa: true, tipo: "TARJETA" },
    }),
  ]);

  const alertasTarjeta = tarjetas
    .map((t) => {
      const limite = aNumero(t.limite);
      if (limite <= 0) return null;
      const pct = (aNumero(t.saldoRestante) / limite) * 100;
      return pct >= 70 ? { nombre: t.nombre, pct, saldo: aNumero(t.saldoRestante), limite } : null;
    })
    .filter((x) => x !== null);

  const disponibleDiario =
    cobertura && cobertura.diasHastaProximoIngresoFijo && cobertura.diasHastaProximoIngresoFijo > 0
      ? cobertura.balanceDisponible / cobertura.diasHastaProximoIngresoFijo
      : null;

  const totalCategorias = resumen.gastoPorCategoria.reduce((a, c) => a + c.total, 0);
  const pctGastado =
    resumen.ingresoDelMes > 0 ? (resumen.gastoDelMes / resumen.ingresoDelMes) * 100 : null;

  return (
    <div>
      {/* Cabecera con el degradado azul: el balance manda, todo lo demás susurra. */}
      <div className="cabecera-degradada -mx-4 -mt-5 mb-5 rounded-b-[32px] px-5 pb-8 pt-7 lg:-mx-8 lg:-mt-6 lg:px-8">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[12.5px] text-brand-deep/70">Mi balance</p>
            <p className="num mt-1 text-[38px] font-semibold leading-none text-brand-deep">
              {fmt(resumen.balanceTotal)}
            </p>
            <p className="mt-2 text-[12.5px] text-brand-deep/70">
              {resumen.tasaBsPorUsd
                ? `Bs ${resumen.tasaBsPorUsd.toFixed(2)} / $`
                : "Sin tasa registrada"}
            </p>
          </div>
          <div className="rounded-full bg-white/60 px-3.5 py-1.5 text-[12.5px] font-medium text-brand-deep">
            {nombreMes(mesPeriodoDe(hoy))}
          </div>
        </div>

        {resumen.balancePorMoneda.length ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {resumen.balancePorMoneda.map((b) => (
              <span
                key={b.moneda}
                className="rounded-full bg-white/70 px-3.5 py-1.5 text-[12.5px] font-medium text-brand-deep"
              >
                {b.moneda === "USD" ? "$ " : "Bs "}
                <span className="num">{formatearMonto(b.total, b.moneda).replace(/^[^\d-]+/, "")}</span>
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {sinCuentas ? (
        <Tarjeta className="mb-4 ring-1 ring-brand/30">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[14.5px] font-bold">Empieza por tus cuentas</p>
              <p className="text-[13px] text-ink-soft">
                Todo lo demás cuelga de ahí: sin una cuenta activa no se pueden registrar
                movimientos ni importar tu historial.
              </p>
            </div>
            <BotonEnlace href="/cuentas">Crear mi primera cuenta</BotonEnlace>
          </div>
        </Tarjeta>
      ) : null}

      {faltaTasa ? (
        <Tarjeta className="mb-4 ring-1 ring-brand/30">
          <p className="text-[13px]">
            Tienes cuentas en las dos monedas pero no hay tasa de cambio registrada, así que no
            puedo calcular los días de cobertura.{" "}
            <Link href="/ajustes" className="font-semibold text-brand-deep underline">
              Registra la tasa
            </Link>
            .
          </p>
        </Tarjeta>
      ) : null}

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          etiqueta="Ingresos del mes"
          valor={fmt(resumen.ingresoDelMes)}
          tono="verde"
          detalle={`Fijo ${fmt(resumen.ingresoFijoDelMes)} · Variable ${fmt(
            resumen.ingresoDelMes - resumen.ingresoFijoDelMes,
          )}`}
        />
        <KpiCard
          etiqueta="Gastos del mes"
          valor={fmt(resumen.gastoDelMes)}
          tono="rojo"
          detalle={
            pctGastado === null
              ? "Sin ingresos registrados este mes"
              : `${Math.round(pctGastado)}% de tus ingresos`
          }
        />
        <KpiCard
          etiqueta="Disponible para gastar hoy"
          valor={disponibleDiario === null ? "—" : fmt(disponibleDiario)}
          sufijo={disponibleDiario === null ? undefined : "/día"}
          detalle={
            disponibleDiario === null
              ? "Registra tu próximo ingreso en el presupuesto"
              : "Hasta tu próximo ingreso"
          }
        />
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="relative overflow-hidden rounded-[22px] bg-linear-to-br from-brand-deep to-brand px-5 py-[18px] text-white sombra-suave">
          <div
            className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(255,255,255,.35), transparent 70%)",
            }}
          />
          <p className="mb-1 text-[13px] font-semibold uppercase tracking-[0.04em] text-white/70">
            Salud financiera
          </p>
          {cobertura ? (
            <GaugeCobertura
              dias={cobertura.diasCobertura}
              diasHastaIngreso={cobertura.diasHastaProximoIngresoFijo}
              estado={cobertura.estado}
            />
          ) : (
            <p className="py-8 text-[13px] text-white/80">
              No se puede calcular la cobertura sin una tasa de cambio registrada.
            </p>
          )}
        </div>

        <Tarjeta>
          <CabeceraTarjeta titulo="Avisos" />
          {alertasTarjeta.map((a) => (
            <Aviso
              key={a.nombre}
              tono="warn"
              icono="⚠️"
              titulo={`${a.nombre} al ${Math.round(a.pct)}% del límite`}
              detalle={`${fmt(a.saldo)} de ${fmt(a.limite)}`}
            />
          ))}
          {proximos.map((p) => {
            const dias = differenceInCalendarDays(p.fechaEsperada, hoy);
            return (
              <Aviso
                key={p.id}
                tono="warn"
                icono={dias < 0 ? "🔴" : "⏰"}
                titulo={
                  dias < 0
                    ? `${p.concepto} está atrasado`
                    : dias === 0
                      ? `${p.concepto} vence hoy`
                      : `${p.concepto} vence en ${dias} día${dias === 1 ? "" : "s"}`
                }
                detalle={`${formatearMonto(aNumero(p.monto), p.moneda)}${
                  p.categoria ? ` · categoría ${p.categoria.nombre}` : ""
                }`}
              />
            );
          })}
          {capacidad.estado === "disponible" && capacidad.capacidadDisponible > 0 ? (
            <Aviso
              tono="ok"
              icono="✅"
              titulo={`Puedes asumir una cuota nueva de hasta ${fmt(capacidad.capacidadDisponible)}/mes`}
              detalle="Sin pasar tu umbral de endeudamiento"
            />
          ) : null}
          {capacidad.estado === "excedido" ? (
            <Aviso
              tono="warn"
              icono="🚫"
              titulo="Ya pasaste tu umbral de endeudamiento"
              detalle={`Comprometes ${fmt(capacidad.compromisosDeudaActuales)}/mes de un ingreso fijo de ${fmt(capacidad.ingresoFijoMensual)}`}
            />
          ) : null}
          {alertasTarjeta.length === 0 && proximos.length === 0 ? (
            <Vacio mensaje="Nada urgente por ahora." />
          ) : null}
        </Tarjeta>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <Tarjeta>
          <CabeceraTarjeta
            titulo="Dónde se está yendo tu dinero"
            extra={<Pill>Este mes</Pill>}
          />
          {resumen.gastoPorCategoria.length ? (
            <div className="relative h-[230px]">
              <ChartCategorias datos={resumen.gastoPorCategoria} />
            </div>
          ) : (
            <Vacio mensaje="Aún no hay gastos registrados este mes." />
          )}
        </Tarjeta>

        <Tarjeta>
          <CabeceraTarjeta titulo="Top categorías" />
          {resumen.gastoPorCategoria.length === 0 ? (
            <Vacio mensaje="Sin datos todavía." />
          ) : (
            resumen.gastoPorCategoria.slice(0, 5).map((c, i) => {
              const pct = totalCategorias > 0 ? (c.total / totalCategorias) * 100 : 0;
              return (
                <div
                  key={c.nombre}
                  className="flex items-center gap-3 border-b border-line py-2.5 last:border-none"
                >
                  <div
                    className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] text-[15px]"
                    style={{ background: c.color ?? "#EEF1EC" }}
                  >
                    {c.icono ?? "•"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-semibold">{c.nombre}</div>
                    <div className="mt-1.5 h-[5px] overflow-hidden rounded-[3px] bg-surface-2">
                      <div
                        className="h-full rounded-[3px]"
                        style={{
                          width: `${pct}%`,
                          background: COLORES_BARRA[i % COLORES_BARRA.length],
                        }}
                      />
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="num text-[13.5px] font-semibold">{fmt(c.total)}</div>
                    <div className="text-[11px] text-ink-soft">{Math.round(pct)}%</div>
                  </div>
                </div>
              );
            })
          )}
        </Tarjeta>
      </div>

      <Tarjeta className="mt-4">
        <CabeceraTarjeta titulo="Ingresos vs. gastos — últimos 6 meses" />
        <div className="relative h-[230px]">
          <ChartTendencia datos={resumen.tendencia} simbolo={m === "USD" ? "$" : "Bs "} />
        </div>
      </Tarjeta>
    </div>
  );
}
