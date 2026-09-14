/**
 * =====================================================
 *  ROLÊS — Proteção de Rotas (Frontend)
 *  Arquivo: Frontend/js/auth.js
 * =====================================================
 */

function requireLogin(opcoes) {
    opcoes = opcoes || {};

    const token    = localStorage.getItem('token');
    const loggedIn = localStorage.getItem('userIsLoggedIn');

    let deveRedirecionar = false;

    if (!token || loggedIn !== 'true') {
        deveRedirecionar = true;
    } else {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const agora   = Math.floor(Date.now() / 1000);
            if (payload.exp && payload.exp < agora) {
                _limparSessao();
                deveRedirecionar = true;
            }
        } catch (e) {
            _limparSessao();
            deveRedirecionar = true;
        }
    }

    if (deveRedirecionar) {
        if (!document.body) {
            document.addEventListener('DOMContentLoaded', function () {
                document.body.style.visibility = 'hidden';
                _redirecionarLogin(opcoes.redirectLogin);
            });
        } else {
            document.body.style.visibility = 'hidden';
            _redirecionarLogin(opcoes.redirectLogin);
        }
        return;
    }

    if (document.body) {
        document.body.style.visibility = 'visible';
    }
}

function estaLogado() {
    const token    = localStorage.getItem('token');
    const loggedIn = localStorage.getItem('userIsLoggedIn');
    if (!token || loggedIn !== 'true') return false;
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const agora   = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < agora) { _limparSessao(); return false; }
    } catch (e) { _limparSessao(); return false; }
    return true;
}

/**
 * Proteção do Dashboard.
 * Só exige que o usuário esteja logado.
 * Se não tiver eventos/estabelecimentos, o dashboard abre vazio
 * com instruções para criar — a lógica de estado vazio fica no dashboard.js.
 */
function requireDashboard() {
    // Só precisa estar logado — abre sempre, vazio ou não
    if (!estaLogado()) {
        _redirecionarLogin();
        return;
    }
    document.body.style.visibility = 'visible';
}

/**
 * Controla visibilidade do link Dashboard no header.
 * Mostra para qualquer usuário logado — com ou sem conteúdo.
 */
function controlarLinkDashboard() {
    const linkDashboard = document.getElementById('dashboard');
    if (!linkDashboard) return;

    if (estaLogado()) {
        linkDashboard.style.display = 'flex';
    } else {
        linkDashboard.style.display = 'none';
    }
}

function logout() {
    _limparSessao();
    window.location.href = _resolverBase() + '/index.html';
}

function _redirecionarLogin(customPath) {
    sessionStorage.setItem('redirectAfterLogin', window.location.href);
    window.location.href = customPath || (_resolverBase() + '/login/login.html');
}

function _limparSessao() {
    ['token','userIsLoggedIn','userType','userId',
     'profileName','profileEmail','profilePhotoUrl',
     'userRole','admin_token','temDashboard']
        .forEach(k => localStorage.removeItem(k));
}

function _resolverBase() {
    const parts = window.location.pathname.split('/');
    const idx   = parts.findIndex(p => p.toLowerCase() === 'frontend');
    return idx !== -1
        ? '/' + parts.slice(0, idx + 1).join('/').replace(/^\//, '')
        : '/frontend';
        
}