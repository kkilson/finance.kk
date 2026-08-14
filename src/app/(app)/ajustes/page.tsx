import { redirect } from "next/navigation";
import { serializar } from "@/lib/api";
import { usuarioActual } from "@/lib/auth";
import { listarTasas } from "@/lib/consultas/basicas";
import { PARAMETRO_DEFAULT, TODAS_LAS_REGLAS } from "@/lib/notificaciones/reglas";
import { aNumero } from "@/lib/moneda";
import { prisma } from "@/lib/prisma";
import type {
  ConfigReglaDTO,
  NotificacionDTO,
} from "@/components/notificaciones/panel-notificaciones";
import { AjustesCliente, type UsuarioDTO } from "./ajustes-cliente";

export const dynamic = "force-dynamic";

export default async function AjustesPage() {
  const usuario = await usuarioActual();
  if (!usuario) redirect("/login");

  const [tasas, guardadas, historial, dispositivos] = await Promise.all([
    listarTasas(),
    prisma.notificacionConfig.findMany({ where: { usuarioId: usuario.id } }),
    prisma.notificacionEnviada.findMany({
      where: { usuarioId: usuario.id },
      orderBy: { enviadaEn: "desc" },
      take: 20,
    }),
    prisma.dispositivoPush.count({ where: { usuarioId: usuario.id, activo: true } }),
  ]);

  const porRegla = new Map(guardadas.map((c) => [c.regla, c]));
  const configs: ConfigReglaDTO[] = TODAS_LAS_REGLAS.map((regla) => {
    const c = porRegla.get(regla);
    return {
      regla,
      activa: c?.activa ?? true,
      parametro: c?.parametro != null ? aNumero(c.parametro) : PARAMETRO_DEFAULT[regla],
      horaDesde: c?.horaDesde ?? 8,
      horaHasta: c?.horaHasta ?? 21,
    };
  });

  return (
    <AjustesCliente
      usuario={serializar(usuario) as unknown as UsuarioDTO}
      tasas={tasas}
      configs={configs}
      historial={serializar(historial) as unknown as NotificacionDTO[]}
      suscrito={dispositivos > 0}
    />
  );
}
