/**
 * lotacaoEvento.js — Barra de lotação na página do evento (tarefa 183)
 *
 * Depende de config.js (window.API_BASE). Consulta GET /lotacao/:id a cada
 * 20 segundos e pausa enquanto a aba está em segundo plano.
 */
(function () {
  "use strict";

  var INTERVALO_MS = 20000;

  var bloco = document.getElementById("lotacao-evento");
  if (!bloco) return;

  // ⚠️ CONFIRA o nome do parâmetro na URL da página do evento (ex.: ?id=120).
  var params = new URLSearchParams(window.location.search);
  var eventoId = params.get("id") || params.get("evento_id") || params.get("eventoId");
  if (!eventoId) return;

  var elBarra = bloco.querySelector(".lotacao-barra");
  var elPreenchimento = document.getElementById("lotacao-preenchimento");
  var elStatus = document.getElementById("lotacao-status");
  var elPercentual = document.getElementById("lotacao-percentual");

  var TEXTOS = {
    baixa: "Ainda tem bastante vaga",
    alta: "Vendendo bem",
    ultimas: "Últimas vagas",
    esgotado: "Esgotado",
  };

  function renderizar(dados) {
    if (!dados || dados.percentual === null || dados.percentual === undefined) {
      bloco.hidden = true;
      return;
    }

    var pct = Math.max(0, Math.min(100, Number(dados.percentual)));

    bloco.hidden = false;
    bloco.setAttribute("data-nivel", dados.nivel || "baixa");
    elPreenchimento.style.width = pct + "%";
    elBarra.setAttribute("aria-valuenow", String(pct));
    elStatus.textContent = TEXTOS[dados.nivel] || "";
    elPercentual.textContent = dados.esgotado
      ? "Todos os ingressos foram vendidos."
      : pct + "% dos ingressos já foram vendidos";
  }

  async function atualizar() {
    try {
      var resp = await fetch(
        window.API_BASE + "/lotacao/" + encodeURIComponent(eventoId),
        { cache: "no-store" }
      );
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      renderizar(await resp.json());
    } catch (e) {
      // Em falha mantém o último valor exibido; se nunca carregou, o bloco segue oculto.
      console.warn("Lotação indisponível:", e.message);
    }
  }

  var timer = null;

  function iniciar() {
    if (timer) return;
    atualizar();
    timer = setInterval(atualizar, INTERVALO_MS);
  }

  function parar() {
    clearInterval(timer);
    timer = null;
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) parar();
    else iniciar();
  });

  iniciar();
})();