// routes/avaliacoes.js

const express    = require("express");
const router     = express.Router();
const authOpcional = require("../middleware/authOpcional");
const {
    listarAvaliacoes,
    criarAvaliacao,
    deletarAvaliacao
} = require("../controllers/avaliacoesController");

// Listar avaliações de um estabelecimento
// GET /avaliacoes?estabelecimento_id=1
router.get("/", listarAvaliacoes);

// Criar nova avaliação (logado ou anônimo)
// POST /avaliacoes
router.post("/", authOpcional, criarAvaliacao);

// Deletar avaliação pelo ID (use no seu painel admin)
// DELETE /avaliacoes/:id
router.delete("/:id", deletarAvaliacao);

module.exports = router;

