// routes/seguidores.js

const express = require("express");
const router  = express.Router();

// ⚠️ Caminho confirmado: middlewares/auth.js (plural "middlewares"),
//    exporta a função diretamente (module.exports = verificarToken;)
const verificarToken = require("../middleware/auth");

const seguidoresController = require("../controllers/seguidoresController");

// Contagem pública de seguidores de um organizador
// GET /seguidores/count/:organizador_id
router.get("/count/:organizador_id", seguidoresController.contarSeguidores);

// Verifica se o usuário logado já segue este organizador
// GET /seguidores/verificar/:organizador_id
router.get("/verificar/:organizador_id", verificarToken, seguidoresController.verificarSeSegue);

// Seguir um organizador
// POST /seguidores   Body: { organizador_id }
router.post("/", verificarToken, seguidoresController.seguir);

// Deixar de seguir
// DELETE /seguidores/:organizador_id
router.delete("/:organizador_id", verificarToken, seguidoresController.deixarDeSeguir);

console.log("📡 ROTAS DE SEGUIDORES CARREGADAS");
module.exports = router;