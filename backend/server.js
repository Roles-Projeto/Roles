/**
 * =====================================================
 *  ROLÊS — servidor raiz
 *  Compatível com Express 4 e 5
 *
 *  RODAR LOCAL:  npx nodemon server.js
 *  Acesse:       http://localhost:3000/frontend/index.html
 * =====================================================
 */

require("dotenv").config();

const express   = require("express");
const cors      = require("cors");
const path      = require("path");
const fs        = require("fs");
const helmet    = require("helmet");
const rateLimit = require("express-rate-limit");

const app = express();

/* ─── Segurança de headers HTTP ─── */
/* ─── Segurança de headers HTTP ─── */
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false,
}));

app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
});



/* ─── Rate limiting geral — 100 requests por IP a cada 15 min ─── */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { erro: "Muitas requisições. Tente novamente em 15 minutos." }
});
app.use("/api", limiter);

/* ─── Rate limiting para login — 10 tentativas por 15 min ─── */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { erro: "Muitas tentativas de login. Tente novamente em 15 minutos." }
});
app.use("/usuarios/login", loginLimiter);

/* ─── Middlewares globais ─── */
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
        // requests sem origin (ex: Postman, mesma origem) passam direto
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

/* ─── Log de requisições ─── */
app.use((req, res, next) => {
  console.log(`🌐 ${req.method} ${req.url}`);
  next();
});

/* ─────────────────────────────────────────────────────
   ARQUIVOS ESTÁTICOS
───────────────────────────────────────────────────── */
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

app.get("/frontend/html/:arquivo", (req, res) => {
  const nomeArquivo = req.params.arquivo.replace(".html", "");
  res.redirect(`/frontend/${nomeArquivo}/${req.params.arquivo}`);
});

app.use("/frontend", caseInsensitiveStatic(path.join(__dirname, "..", "Frontend")));
app.use("/frontend", express.static(path.join(__dirname, "..", "Frontend")));
app.use("/uploads",  express.static(path.join(__dirname, "uploads")));

/* ─────────────────────────────────────────────────────
   ROTAS DA API
───────────────────────────────────────────────────── */
const usuariosRoutes         = require("./routes/usuarios");
const authRoutes             = require("./routes/auth");
const eventosRoutes          = require("./routes/eventos");
const estabelecimentosRoutes = require("./routes/estabelecimentos");
const contatoRoutes          = require("./routes/contato");
const avaliacoesRoutes       = require("./routes/avaliacoes");
const adminRoutes            = require("./routes/admin");
const { ingressosRouter, pedidosRouter } = require("./routes/ingressosRoutes");

// Rotas opcionais — carregadas só se o arquivo existir
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

// const { iniciarPoller } = require("./services/gmailPoller");
// iniciarPoller();

app.use("/usuarios",         usuariosRoutes);
app.use("/usuarios",         authRoutes);
app.use("/eventos",          eventosRoutes);
app.use("/estabelecimentos", estabelecimentosRoutes);
app.use("/contato",          contatoRoutes);
app.use("/avaliacoes",       avaliacoesRoutes);
app.use("/admin",            adminRoutes);
app.use("/ingressos",        ingressosRouter);
app.use("/pedidos",          pedidosRouter);

if (favoritosRoutes) app.use("/favoritos", favoritosRoutes);
if (visitasRoutes)   app.use("/visitas",   visitasRoutes);
if (comprasRoutes)   app.use("/compras",   comprasRoutes);
if (historicoRoutes) app.use("/historico", historicoRoutes);

/* ─────────────────────────────────────────────────────
   FALLBACK SPA
   Serve o index.html APENAS para rotas de frontend.
   Rotas de API desconhecidas retornam 404 JSON.
───────────────────────────────────────────────────── */
const API_PREFIXES = [
  "/usuarios", "/auth", "/eventos", "/estabelecimentos",
  "/contato", "/avaliacoes", "/admin", "/ingressos",
  "/pedidos", "/favoritos", "/visitas", "/compras", "/historico",
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

/* ─── Handler de erros ─── */
app.use((err, req, res, next) => {
  console.error("❌ ERRO:", err.message);
  res.status(500).json({ erro: "Erro interno.", detalhes: err.message });
});

/* ─── Inicia servidor ─── */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("================================");
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📍 http://localhost:${PORT}/frontend/index.html`);
  console.log(`📧 Email: ${process.env.EMAIL_USER || "⚠️ NÃO DEFINIDO"}`);
  console.log("================================");
});