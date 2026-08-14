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
import { Aviso, BotonEnlace, CabeceraTarjeta, Pill, Tarjeta, Topbar, Vacio } from "@/components/ui";

export const dynamic = "force-dynamic";

const COLORES_BARRA = ["#3F7A50", "#C9962C", "#7C6BC4", "#C1483D", "#D9A83B"];

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
      <Topbar
        titulo={`Hola — así estás cerrando ${nombreMes(mesPeriodoDe(hoy)).split(" ")[0].toLowerCase()}`}
        subtitulo="Resumen general de tus finanzas, actualizado con tus movimientos del mes"
        extra={
          <div className="rounded-[10px] border border-line bg-surface px-3.5 py-2 text-[12.5px] text-ink-soft">
            📅 {nombreMes(mesPeriodoDe(hoy))}
          </div>
        }
      />

      {sinCuentas ? (
        <Tarjeta className="mb-4 border-gold">
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
        <Tarjeta className="mb-4 border-gold">
          <p className="text-[13px]">
            Tienes cuentas en las dos monedas pero no hay tasa de cambio registrada, así que no
            puedo calcular los días de cobertura.{" "}
            <Link href="/ajustes" className="font-semibold text-teal underline">
              Registra la tasa
            </Link>
            .
          </p>
        </Tarjeta>
      ) : null}

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          etiqueta="Balance total"
          valor={fmt(resumen.balanceTotal)}
          detalle={resumen.balancePorMoneda
            .map((b) => formatearMonto(b.total, b.moneda))
            .join("  ·  ")}
        />
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
        <div className="relative overflow-hidden rounded-[20px] bg-linear-to-br from-teal-deep to-teal px-5 py-[18px] text-white">
          <div
            className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(201,150,44,.35), transparent 70%)",
            }}
          />
          <p className="mb-1 text-[13px] font-semibold uppercase tracking-[0.04em] text-[#B9D8D4]">
            Salud financiera
          </p>
          {cobertura ? (
            <GaugeCobertura
              dias={cobertura.diasCobertura}
              diasHastaIngreso={cobertura.diasHastaProximoIngresoFijo}
              estado={cobertura.estado}
            />
          ) : (
            <p className="py-8 text-[13px] text-[#D8ECE9]">
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
