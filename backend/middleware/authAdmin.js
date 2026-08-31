const jwt = require("jsonwebtoken");

function authAdmin(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ erro: "Token não fornecido." });
    }
    const token = authHeader.split(" ")[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== "admin") {
            return res.status(403).json({ erro: "Acesso negado. Apenas admins." });
        }
        req.usuario = decoded;
        next();
    } catch (_) {
        return res.status(401).json({ erro: "Token inválido." });
    }
}

module.exports = authAdmin;



