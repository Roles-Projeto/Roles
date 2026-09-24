require("dotenv").config();

const express   = require("express");
const cors      = require("cors");
const path      = require("path");
const fs        = require("fs");
const helmet    = require("helmet");
const rateLimit = require("express-rate-limit");

const app = express();

app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false,
}));

app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
});

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { erro: "Muitas requisições. Tente novamente em 15 minutos." }
});
app.use("/api", limiter);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { erro: "Muitas tentativas de login. Tente novamente em 15 minutos." }
});
app.use("/usuarios/login", loginLimiter);

const allowedOrigins = [
    "http://127.0.0.1:5502",
    "http://localhost:5502",
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://projeto-integrador-roles.onrender.com",
];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error("Não permitido pelo CORS"));
        }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.use((req, res, next) => {
  console.log(`🌐 ${req.method} ${req.url}`);
  next();
});

app.get('/service-worker.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'service-worker.js'));
});

function caseInsensitiveStatic(baseDir) {
  return (req, res, next) => {
    const filePath = path.join(baseDir, req.url);
    const dir  = path.dirname(filePath);
    const base = path.basename(filePath).toLowerCase();
    try {
      const files = fs.readdirSync(dir);
      const match = files.find(f => f.toLowerCase() === base);
      if (match) req.url = req.url.replace(path.basename(req.url), match);
    } catch (e) {}
    next();
  };
}

app.use("/frontend", caseInsensitiveStatic(path.join(__dirname, "..", "Frontend")));
app.use("/frontend", express.static(path.join(__dirname, "..", "Frontend")));
app.use("/uploads",  express.static(path.join(__dirname, "uploads")));

const usuariosRoutes         = require("./routes/usuarios");
const authRoutes             = require("./routes/auth");
const eventosRoutes          = require("./routes/eventos");
const estabelecimentosRoutes = require("./routes/estabelecimentos");
const contatoRoutes          = require("./routes/contato");
const avaliacoesRoutes       = require("./routes/avaliacoes");
const adminRoutes            = require("./routes/admin");
const { ingressosRouter, pedidosRouter } = require("./routes/ingressosRoutes");
const recomendacaoRoutes     = require("./routes/recomendacaoRoutes");

function tryRequire(routePath) {
  try {
    const mod = require(path.join(__dirname, routePath));
    return mod;
  } catch (e) {
    console.warn(`⚠️  Rota não encontrada (ignorada): ${routePath} — ${e.message}`);
    return null;
  }
}
const favoritosRoutes = tryRequire("./routes/favoritos");
const visitasRoutes   = tryRequire("./routes/visitas");
const comprasRoutes   = tryRequire("./routes/compras");
const historicoRoutes = tryRequire("./routes/historico");

app.use("/usuarios",         usuariosRoutes);
app.use("/usuarios",         authRoutes);
app.use("/eventos",          eventosRoutes);
app.use("/estabelecimentos", estabelecimentosRoutes);
app.use("/contato",          contatoRoutes);
app.use("/avaliacoes",       avaliacoesRoutes);
app.use("/admin",            adminRoutes);
app.use("/ingressos",        ingressosRouter);
app.use("/pedidos",          pedidosRouter);
app.use("/seguidores", require("./routes/seguidoresRoutes"));
app.use("/recomendacoes",    recomendacaoRoutes);

if (favoritosRoutes) app.use("/favoritos", favoritosRoutes);
if (visitasRoutes)   app.use("/visitas",   visitasRoutes);
if (comprasRoutes)   app.use("/compras",   comprasRoutes);
if (historicoRoutes) app.use("/historico", historicoRoutes);

const API_PREFIXES = [
  "/usuarios", "/auth", "/eventos", "/estabelecimentos",
  "/contato", "/avaliacoes", "/admin", "/ingressos",
  "/pedidos", "/favoritos", "/visitas", "/compras", "/historico",
  "/recomendacoes",
];

app.use((req, res) => {
  const isApiRoute = API_PREFIXES.some(prefix => req.path.startsWith(prefix));

  if (isApiRoute) {
    return res.status(404).json({ erro: `Rota não encontrada: ${req.method} ${req.path}` });
  }

  const indexPath = path.join(__dirname, "..", "Frontend", "index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ erro: "Frontend não encontrado." });
  }
});

app.use((err, req, res, next) => {
  console.error("❌ ERRO:", err.message);
  res.status(500).json({ erro: "Erro interno.", detalhes: err.message });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("================================");
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📍 http://localhost:${PORT}/frontend/index.html`);
  console.log(`📧 Email: ${process.env.EMAIL_USER || "⚠️ NÃO DEFINIDO"}`);
  console.log("================================");
});