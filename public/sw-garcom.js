/* Service worker da área do garçom: recebe as notificações push mesmo com a página fechada
   ou o celular bloqueado, e abre a área do garçom quando a notificação é tocada. */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

const IMPORTANTES = new Set(['pronto', 'garcom', 'conta']);

self.addEventListener('push', (event) => {
  let d;
  try {
    d = event.data.json();
  } catch {
    d = { titulo: 'Cardápio Online', corpo: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(d.titulo || 'Cardápio Online', {
        body: d.corpo || '',
        tag: d.tag,                     // mesmo pedido/mesa: substitui em vez de empilhar
        renotify: true,                 // …mas toca/vibra de novo
        requireInteraction: IMPORTANTES.has(d.tipo), // fica na tela até o garçom ver
        vibrate: [200, 100, 200, 100, 300],
        icon: '/icone-192.png',
        badge: '/badge-96.png',
        data: { url: d.url || '/garcom/' },
      });
      // Se a página estiver aberta, avisa para atualizar a lista na hora.
      const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      janelas.forEach((j) => j.postMessage({ tipo: 'push', dados: d }));
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/garcom/';
  event.waitUntil(
    (async () => {
      const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const aberta = janelas.find((j) => new URL(j.url).pathname.startsWith('/garcom/'));
      if (aberta) return aberta.focus();
      return self.clients.openWindow(url);
    })()
  );
});
