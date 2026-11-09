// service-worker.js

// Instalação do Service Worker
self.addEventListener('install', (event) => {
    console.log('👷 Service Worker instalado.');
    self.skipWaiting();
});

// Ativação
self.addEventListener('activate', (event) => {
    console.log('👷 Service Worker ativo.');
    event.waitUntil(clients.claim());
});

// ESCUTADOR DE NOTIFICAÇÕES PUSH (Responsável por exibir os alertas)
self.addEventListener('push', (event) => {
    let data = { titulo: 'Roles', mensagem: 'Você tem uma nova notificação!' };

    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data.mensagem = event.data.text();
        }
    }

    const options = {
        body: data.mensagem || data.body || 'Confira os eventos disponíveis!',
        // A pasta do projeto é "imagens" (não "images"). Confirme que este arquivo existe.
        icon: '/frontend/imagens/logo3.png',
        badge: '/frontend/imagens/logo3.png',
        data: { url: data.url || '/frontend/index.html' }
    };

    event.waitUntil(
        self.registration.showNotification(data.titulo || data.title || 'Roles', options)
    );
});

// Clique na notificação
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    if (event.notification.data && event.notification.data.url) {
        event.waitUntil(
            clients.openWindow(event.notification.data.url)
        );
    }
});