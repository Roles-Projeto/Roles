"use strict";

const express = require("express");
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
    listarTiposIngresso,   // ← novo
    criarTipoIngresso,     // ← novo
    atualizarTipoIngresso, // ← novo
    excluirTipoIngresso,   // ← novo
} = require("../controllers/ingressosController");

const { downloadIngressoPDF } = require("../controllers/ticketPdfController");

// -- Router de EVENTOS --
const eventosRouter = express.Router();
eventosRouter.get("/",    listarEventos);
eventosRouter.get("/:id", detalheEvento);

// -- Router de INGRESSOS --
const ingressosRouter = express.Router();
ingressosRouter.post("/comprar",            comprarIngresso);
ingressosRouter.get("/usuario/:usuario_id", meusIngressos);
ingressosRouter.get("/totais/:usuario_id",  totalIngressosPorUsuario);

// -- Tipos de ingresso (modal "Gerenciar ingressos" do dashboard) --
ingressosRouter.get("/tipos/:evento_id",    listarTiposIngresso);  // ← novo
ingressosRouter.post("/tipos",              criarTipoIngresso);    // ← novo
ingressosRouter.put("/tipos/:id",           atualizarTipoIngresso);// ← novo
ingressosRouter.delete("/tipos/:id",        excluirTipoIngresso);  // ← novo

ingressosRouter.get("/validar/:codigo_qr",  validarQRCode);
ingressosRouter.get("/:id/download",        downloadIngressoPDF);  // ← antes de /:id
ingressosRouter.get("/:id",                 detalheIngresso);

// -- Router de PEDIDOS --
const pedidosRouter = express.Router();
pedidosRouter.get("/usuario/:usuario_id", meusIngressos);
pedidosRouter.get("/vendas/:usuario_id", vendasDoDono);
pedidosRouter.post("/:id/reenviar-email", reenviarEmailIngresso);

module.exports = { eventosRouter, ingressosRouter, pedidosRouter };