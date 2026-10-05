const jwt = require("jsonwebtoken");

function verificarToken(req, res, next) {
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ erro: "Token não fornecido." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = payload; // { id, email, role }
    next();
  } catch (err) {
    return res.status(401).json({ erro: "Token inválido ou expirado." });
  }
}

// =====================================================
// AUTENTICAÇÃO OPCIONAL
// Usada em rotas públicas que se comportam melhor quando sabem
// quem é o usuário, mas não podem exigir login (ex: listar assentos
// — qualquer visitante vê o mapa, mas se estiver logado o backend
// consegue marcar quais assentos são reservas DELE).
//
// Nunca bloqueia a requisição: sem token, token mal formado ou
// token expirado, só segue em frente com req.usuario vazio.
// =====================================================
function autenticacaoOpcional(req, res, next) {
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = payload;
  } catch (err) {
    // token inválido/expirado: ignora silenciosamente, segue sem usuário
  }

  next();
}

module.exports = verificarToken;
module.exports.autenticacaoOpcional = autenticacaoOpcional;