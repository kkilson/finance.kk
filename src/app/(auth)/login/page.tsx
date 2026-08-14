"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Boton, Campo, Input, Tarjeta } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) {
      router.replace("/dashboard");
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({ error: "Error inesperado" }));
      setError(body.error ?? "Error inesperado");
      setEnviando(false);
    }
  }

  return (
    <main className="cabecera-degradada flex min-h-screen items-center justify-center p-6">
      <Tarjeta className="w-full max-w-sm">
        <div className="mb-5 flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-brand to-brand-deep">
            <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]">
              <path
                d="M4 18L10 10L14 14L20 6"
                stroke="#fff"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <h1 className="font-display text-[20px] font-bold">Rumbo</h1>
            <p className="-mt-0.5 text-[12px] text-ink-soft">
              Tus finanzas en bolívares y dólares
            </p>
          </div>
        </div>
        <form onSubmit={enviar} className="flex flex-col gap-4">
          <Campo etiqueta="Email">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </Campo>
          <Campo etiqueta="Contraseña">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </Campo>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Boton type="submit" disabled={enviando}>
            {enviando ? "Entrando…" : "Entrar"}
          </Boton>
        </form>
      </Tarjeta>
    </main>
  );
}
