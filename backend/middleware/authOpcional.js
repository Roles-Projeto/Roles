// middleware/authOpcional.js
// Verifica JWT se existir — mas NÃO bloqueia se não tiver.
// req.usuario será { id, email } se logado, ou null se anônimo.

const jwt = require("jsonwebtoken");

function authOpcional(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        req.usuario = null;
        return next();
    }

    const token = authHeader.split(" ")[1];

    try {
        req.usuario = jwt.verify(token, process.env.JWT_SECRET);
    } catch (_) {
        req.usuario = null;
    }

    next();
}

module.exports = authOpcional;



