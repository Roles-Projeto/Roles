/**
 * config.js — URL base da API
 * Detecta automaticamente se está em localhost ou produção.
 *
 * IMPORTANTE: Este script deve ser carregado ANTES de qualquer
 * outro JS que faça fetch para a API.
 *
 * Uso nos outros arquivos JS:
 *   fetch(${window.API_BASE}/eventos)
 */

(function () {
  const isLocal =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  // Troque pela URL real do seu projeto no Render
  const RENDER_URL = "https://projeto-integrador-roles-271b.onrender.com";

  window.API_BASE = isLocal ? "http://localhost:3000" : RENDER_URL;

  console.log("🔧 API_BASE: " + window.API_BASE);
})();