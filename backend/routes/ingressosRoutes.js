"use strict";

// PASSO A: só a compra exige login. As demais rotas ficam como antes
// (o site ainda não manda token nelas). Depois do Passo B, use o
// ingressosRoutes_passoC.js para proteger o resto.

const express = require("express");
const { verificarToken } = require("../middleware/auth");
const {
    listarEventos,
    detalheEvento,
    comprarIngresso,
    meusIngressos,
    validarQRCode,
    detalheIngresso,
    reenviarEmailIngresso,
    vendasDoDono,
    totalIngressosPorUsuario,
    listarTiposIngresso,
    criarTipoIngresso,
    atualizarTipoIngresso,
    excluirTipoIngresso,
} = require("../controllers/ingressosController");

const { downloadIngressoPDF } = require("../controllers/ticketPdfController");

// -- Router de EVENTOS --
const eventosRouter = express.Router();
eventosRouter.get("/",    listarEventos);
eventosRouter.get("/:id", detalheEvento);

// -- Router de INGRESSOS --
const ingressosRouter = express.Router();

ingressosRouter.post("/comprar",            verificarToken, comprarIngresso);
ingressosRouter.get("/usuario/:usuario_id", meusIngressos);
ingressosRouter.get("/totais/:usuario_id",  totalIngressosPorUsuario);

// -- Tipos de ingresso (modal "Gerenciar ingressos" do dashboard) --
ingressosRouter.get("/tipos/:evento_id",    listarTiposIngresso);
ingressosRouter.post("/tipos",              verificarToken, criarTipoIngresso);
ingressosRouter.put("/tipos/:id",           verificarToken, atualizarTipoIngresso);
ingressosRouter.delete("/tipos/:id",        verificarToken, excluirTipoIngresso);

ingressosRouter.get("/validar/:codigo_qr",  validarQRCode);
ingressosRouter.get("/:id/download",        downloadIngressoPDF);  // antes de /:id
ingressosRouter.get("/:id",                 detalheIngresso);

// -- Router de PEDIDOS --
const pedidosRouter = express.Router();
pedidosRouter.get("/usuario/:usuario_id", meusIngressos);
pedidosRouter.get("/vendas/:usuario_id", vendasDoDono);
pedidosRouter.post("/:id/reenviar-email", reenviarEmailIngresso);

module.exports = { eventosRouter, ingressosRouter, pedidosRouter };