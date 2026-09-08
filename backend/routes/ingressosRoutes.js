"use strict";

const express = require("express");
const {
    listarEventos,
    detalheEvento,
    comprarIngresso,
    meusIngressos,
    validarQRCode,
    detalheIngresso,
    reenviarEmailIngresso,   // ← novo
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
ingressosRouter.get("/validar/:codigo_qr",  validarQRCode);
ingressosRouter.get("/:id/download",        downloadIngressoPDF);  // ← antes de /:id
ingressosRouter.get("/:id",                 detalheIngresso);

// -- Router de PEDIDOS --
// -- Router de PEDIDOS --
const pedidosRouter = express.Router();
pedidosRouter.get("/usuario/:usuario_id", meusIngressos);
pedidosRouter.post("/:id/reenviar-email", reenviarEmailIngresso);   // ← novo

module.exports = { eventosRouter, ingressosRouter, pedidosRouter };

