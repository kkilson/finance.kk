export class ApiError extends Error {
  campo?: string;
  constructor(mensaje: string, campo?: string) {
    super(mensaje);
    this.name = "ApiError";
    this.campo = campo;
  }
}

async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(body?.error ?? `Error ${res.status}`, body?.campo);
  }
  return body as T;
}

export const api = {
  get: <T>(url: string) => pedir<T>(url),
  post: <T>(url: string, data: unknown) =>
    pedir<T>(url, { method: "POST", body: JSON.stringify(data) }),
  patch: <T>(url: string, data: unknown) =>
    pedir<T>(url, { method: "PATCH", body: JSON.stringify(data) }),
  del: <T>(url: string) => pedir<T>(url, { method: "DELETE" }),
};
