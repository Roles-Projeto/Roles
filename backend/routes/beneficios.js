// backend/routes/beneficios.js   (arquivo do BACKEND)
// GET /beneficios/status  ->  { comprasPagas: N, beneficioDisponivel: true|false }
// O front usa "beneficioDisponivel" para mostrar (ou não) o desconto de boas-vindas.
// Quem decide de verdade é o backend, na hora da compra (comprarIngresso).

const express = require("express");
const jwt = require("jsonwebtoken");
const { situacaoBeneficio } = require("../services/beneficiosService");

const router = express.Router();

// Lê o token do header Authorization e descobre o id do usuário
function idDoUsuario(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.id ?? decoded.userId ?? decoded.usuario_id ?? decoded.usuarioId ?? null;
  } catch (_) {
    return null;
  }
}

router.get("/status", async (req, res) => {
  const usuarioId = idDoUsuario(req);
  if (!usuarioId) {
    return res.status(401).json({ erro: "Token inválido ou ausente." });
  }

  try {
    const situacao = await situacaoBeneficio(usuarioId);
    res.json({
      comprasPagas: situacao.comprasPagas,
      beneficioDisponivel: situacao.disponivel,
    });
  } catch (err) {
    console.error("❌ /beneficios/status:", err.message);
    res.status(500).json({ erro: "Erro ao consultar benefícios." });
  }
});

module.exports = router;
