"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Boton, Campo, Input, Segmentado, Select, Tarjeta, Tile, Topbar, Vacio } from "@/components/ui";
import { api } from "@/lib/cliente-api";
import type { CategoriaDTO, TipoCategoria } from "@/types";

export function CategoriasCliente({ categorias }: { categorias: CategoriaDTO[] }) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [vista, setVista] = useState<TipoCategoria>("GASTO");
  const [abierto, setAbierto] = useState(false);
  const [editando, setEditando] = useState<CategoriaDTO | null>(null);

  const [nombre, setNombre] = useState("");
  const [icono, setIcono] = useState("");
  const [grupoId, setGrupoId] = useState("");

  const delTipo = categorias.filter((c) => c.tipo === vista);
  const grupos = delTipo.filter((c) => c.grupoId === null);
  const sueltas = delTipo.filter((c) => c.grupoId === null && vista === "INGRESO");

  async function accion(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      startTransition(() => router.refresh());
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div>
      <Topbar
        titulo="Categorías"
        subtitulo="La misma estructura que ya usas, lista para registrar cada movimiento en segundos"
      />

      <div className="mb-5">
        <Segmentado
          valor={vista}
          onChange={setVista}
          tonoActivo={vista === "GASTO" ? "danger" : "success"}
          opciones={[
            { valor: "GASTO", label: "↓ Gastos" },
            { valor: "INGRESO", label: "↑ Ingresos" },
          ]}
        />
      </div>

      {error ? <p className="mb-3 text-[13px] text-danger">{error}</p> : null}

      {editando ? (
        <Tarjeta className="mb-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget as HTMLFormElement);
              await accion(() =>
                api.patch(`/api/categorias/${editando.id}`, {
                  nombre: String(f.get("nombre")),
                  icono: String(f.get("icono")) || null,
                  color: String(f.get("color")) || null,
                }),
              );
              setEditando(null);
            }}
            className="grid gap-4 md:grid-cols-4 md:items-end"
          >
            <Campo etiqueta="Nombre">
              <Input name="nombre" defaultValue={editando.nombre} required />
            </Campo>
            <Campo etiqueta="Ícono">
              <Input
                name="icono"
                defaultValue={editando.icono ?? ""}
                maxLength={2}
                className="text-center"
              />
            </Campo>
            <Campo etiqueta="Color de fondo" hint="Hex, como #E6EEF9">
              <Input name="color" defaultValue={editando.color ?? ""} />
            </Campo>
            <div className="flex gap-2">
              <Boton type="submit">Guardar</Boton>
              <Boton type="button" variante="secundario" onClick={() => setEditando(null)}>
                Cancelar
              </Boton>
            </div>
          </form>
        </Tarjeta>
      ) : null}

      {vista === "GASTO" ? (
        grupos.length === 0 ? (
          <Vacio mensaje="Sin categorías de gasto. Corre el seed o crea la primera." />
        ) : (
          grupos.map((g) => {
            const subs = categorias.filter((c) => c.grupoId === g.id);
            return (
              <div
                key={g.id}
                className="mb-3 rounded-[22px] bg-surface px-[18px] py-4 sombra-suave"
              >
                <div className="mb-3 flex items-center gap-2.5">
                  <Tile color={g.color} tamano="sm">
                    {g.icono ?? "•"}
                  </Tile>
                  <div className="text-[14.5px] font-bold">{g.nombre}</div>
                  <button
                    onClick={() => setEditando(g)}
                    title="Editar grupo"
                    className="ml-auto text-[13px] text-ink-soft hover:text-brand"
                  >
                    ✎
                  </button>
                  <button
                    onClick={() => accion(() => api.del(`/api/categorias/${g.id}`))}
                    title="Archivar grupo"
                    className="text-[13px] text-ink-soft hover:text-danger"
                  >
                    ×
                  </button>
                </div>
                {subs.length === 0 ? (
                  <p className="text-[12px] text-ink-soft">Este grupo no tiene subcategorías.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {subs.map((s) => (
                      <span
                        key={s.id}
                        className="group flex items-center gap-1.5 rounded-[20px] px-3 py-[7px] text-[12.5px] font-medium"
                        style={{ background: s.color ?? "#EEF1EC" }}
                      >
                        {s.icono ?? "•"} {s.nombre}
                        <button
                          onClick={() => setEditando(s)}
                          title="Editar"
                          className="opacity-0 transition hover:text-brand group-hover:opacity-100"
                        >
                          ✎
                        </button>
                        <button
                          onClick={() => accion(() => api.del(`/api/categorias/${s.id}`))}
                          title="Archivar"
                          className="opacity-0 transition hover:text-danger group-hover:opacity-100"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )
      ) : sueltas.length === 0 ? (
        <Vacio mensaje="Sin categorías de ingreso." />
      ) : (
        <div className="mb-3.5 flex flex-wrap gap-3">
          {sueltas.map((c) => (
            <div
              key={c.id}
              className="group flex min-w-[220px] flex-1 items-center gap-3.5 rounded-[18px] bg-surface px-4 py-3.5 sombra-suave"
            >
              <Tile color={c.color}>{c.icono ?? "•"}</Tile>
              <div className="text-[13.5px] font-semibold">{c.nombre}</div>
              <div className="ml-auto flex gap-2 opacity-0 transition group-hover:opacity-100">
                <button
                  onClick={() => setEditando(c)}
                  className="text-[13px] text-ink-soft hover:text-brand"
                  title="Editar"
                >
                  ✎
                </button>
                <button
                  onClick={() => accion(() => api.del(`/api/categorias/${c.id}`))}
                  className="text-[13px] text-ink-soft hover:text-danger"
                  title="Archivar"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {abierto ? (
        <Tarjeta className="mb-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const grupo = grupos.find((g) => g.id === grupoId);
              await accion(() =>
                api.post("/api/categorias", {
                  nombre,
                  tipo: vista,
                  icono: icono || null,
                  grupoId: grupoId || null,
                  // Hereda el color del grupo para que el chip se vea consistente.
                  color: grupo?.color ?? null,
                }),
              );
              setNombre("");
              setIcono("");
              setAbierto(false);
            }}
            className="grid gap-4 md:grid-cols-4 md:items-end"
          >
            <Campo etiqueta="Nombre">
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
            </Campo>
            <Campo etiqueta="Ícono">
              <Input
                value={icono}
                onChange={(e) => setIcono(e.target.value)}
                maxLength={2}
                className="text-center"
                placeholder="🛒"
              />
            </Campo>
            {vista === "GASTO" ? (
              <Campo etiqueta="Grupo">
                <Select value={grupoId} onChange={(e) => setGrupoId(e.target.value)}>
                  <option value="">Sin grupo (crear grupo nuevo)</option>
                  {grupos.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nombre}
                    </option>
                  ))}
                </Select>
              </Campo>
            ) : null}
            <Boton type="submit" disabled={pendiente}>
              Guardar
            </Boton>
          </form>
        </Tarjeta>
      ) : null}

      <div className="flex justify-center">
        <Boton onClick={() => setAbierto((v) => !v)}>
          {abierto ? "Cancelar" : "+ Nueva categoría"}
        </Boton>
      </div>
    </div>
  );
}
