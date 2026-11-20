const VAPID_PUBLIC_KEY = "BDaiaR2BlxUXv5VPevCbj44ibmvHB9t5ztdnKx3DpfJcz2fxAPNxE3i5BzVs61fYMa28gS5BiTj0S5TL7RAx_iY";

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

async function ativarNotificacoes(usuarioId) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push não suportado nesse navegador.');
    return;
  }

  // Registra o service worker pela URL do backend, não pela origem do Live Server
  const registro = await navigator.serviceWorker.register(`${window.API_BASE}/service-worker.js`);

  const permissao = await Notification.requestPermission();
  if (permissao !== 'granted') {
    console.warn('Usuário não permitiu notificações.');
    return;
  }

  const inscricao = await registro.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
  });

  await fetch(`${window.API_BASE}/recomendacoes/push/inscrever`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuarioId, inscricao })
  });
}