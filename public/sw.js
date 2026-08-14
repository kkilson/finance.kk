// Service Worker de Rumbo: solo push y click. No cachea nada — la app se sirve
// desde el mismo servidor y no necesitamos modo offline en la versión web.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let datos = { titulo: "Rumbo", cuerpo: "", url: "/dashboard" };
  try {
    if (event.data) datos = { ...datos, ...event.data.json() };
  } catch {
    if (event.data) datos.cuerpo = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(datos.titulo, {
      body: datos.cuerpo,
      icon: "/icono-192.png",
      badge: "/icono-192.png",
      data: { url: datos.url },
      // Un aviso del mismo tipo reemplaza al anterior en vez de apilarse.
      tag: datos.url,
      renotify: false,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = event.notification.data?.url ?? "/dashboard";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientes) => {
      // Si Rumbo ya está abierto, lo enfocamos en vez de abrir otra pestaña.
      for (const c of clientes) {
        if (c.url.includes(self.location.origin)) {
          c.navigate(destino);
          return c.focus();
        }
      }
      return self.clients.openWindow(destino);
    }),
  );
});
