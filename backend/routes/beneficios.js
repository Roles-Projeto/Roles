// backend/routes/beneficios.js   (arquivo do BACKEND)
// GET /beneficios/status  ->  { comprasPagas: N }
// O front usa esse número para saber se o usuário tem direito ao
// desconto de boas-vindas (comprasPagas === 0 = primeira compra).

const express = require("express");
const jwt = require("jsonwebtoken");
const connection = require("../db/db_config");

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

// Conta os pedidos PAGOS do usuário: venda com valor > 0 e que não foi cancelada.
// Ingresso gratuito (status "cortesia", valor 0) não conta como compra paga.
const CONDICOES = `
  FROM vendas
  WHERE usuario_id = PARAM
    AND valor_total > 0
    AND pedido_id IS NOT NULL
    AND LOWER(status) NOT IN ('cancelado', 'cancelada', 'estornado', 'expirado')
`;
const SQL_INTERROGACAO = `SELECT COUNT(DISTINCT pedido_id) AS total ${CONDICOES}`.replace("PARAM", "?");
const SQL_CIFRAO       = `SELECT COUNT(DISTINCT pedido_id) AS total ${CONDICOES}`.replace("PARAM", "$1");

// Tenta com "?" (padrão do db_config); se o banco reclamar da sintaxe, tenta com "$1"
function contarComprasPagas(usuarioId, cb) {
  connection.query(SQL_INTERROGACAO, [usuarioId], (err, resultado) => {
    if (err && /syntax|placeholder|parameter/i.test(err.message || "")) {
      return connection.query(SQL_CIFRAO, [usuarioId], cb);
    }
    cb(err, resultado);
  });
}

router.get("/status", (req, res) => {
  const usuarioId = idDoUsuario(req);
  if (!usuarioId) {
    return res.status(401).json({ erro: "Token inválido ou ausente." });
  }

  contarComprasPagas(usuarioId, (err, resultado) => {
    if (err) {
      console.error("❌ /beneficios/status:", err.message);
      return res.status(500).json({ erro: "Erro ao consultar benefícios." });
    }

    // Aceita os dois formatos de retorno (lista direta ou { rows })
    const linhas = Array.isArray(resultado) ? resultado : (resultado?.rows || []);
    const total = Number(linhas[0]?.total) || 0;

    res.json({ comprasPagas: total });
  });
});

module.exports = router;