// backend/routes/assentos.js
const express = require("express");
const router = express.Router();
const assentosController = require("../controllers/assentosController");
const { verificarToken } = require("../middleware/auth");
const { autenticacaoOpcional } = require("../middleware/auth");

// Lista os assentos de um ingresso (setor numerado) com status calculado.
// Pública (não exige login) para o comprador ver o mapa antes de logar,
// mas com autenticacaoOpcional: se vier um token válido, req.usuario é
// preenchido e o backend marca quais assentos são "reservado_por_voce".
router.get("/:ingressoId", autenticacaoOpcional, assentosController.listarAssentosPorIngresso);

// Reservar e liberar exigem login — precisa saber de quem é a reserva.
router.post("/:id/reservar", verificarToken, assentosController.reservarAssento);
router.delete("/:id/reservar", verificarToken, assentosController.liberarReserva);

module.exports = router;