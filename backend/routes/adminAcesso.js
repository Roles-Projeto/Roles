"use strict";
// backend/routes/adminAcesso.js
// Permissões por módulo + equipe de administradores (só Master).
// O papel (role) é lido do BANCO a cada requisição, então rebaixar alguém vale na hora.
//
// Arquivamento: nada é excluído de verdade. DELETE nos módulos de dados está bloqueado;
// o caminho é PUT /admin/:modulo/:id/arquivar (rota em adminArquivo.js).

const express = require("express");
const jwt = require("jsonwebtoken");
const connection = require("../db/db_config");

const MODULOS = ["usuarios", "estabelecimentos", "eventos", "avaliacoes", "ingressos", "pedidos", "mensagens"];
const ACOES = ["ver", "editar", "aprovar", "excluir"];
const router = express.Router();

const q = (sql, p = []) => connection.query(sql, p);
const h = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch((e) => {
        console.error("adminAcesso:", e.message);
        res.status(500).json({ erro: "Erro interno." });
    });

function idDoToken(req) {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return null;
    try {
        const p = jwt.verify(token, process.env.JWT_SECRET);
        return p.id || p.userId || p.user_id || p.sub || null;
    } catch {
        return null;
    }
}

async function carregarPermissoes(id) {
    const p = {};
    (await q("SELECT modulo, ver, editar, aprovar, excluir FROM permissoes WHERE usuario_id = ?", [id]))
        .forEach((r) => (p[r.modulo] = { ver: !!r.ver, editar: !!r.editar, aprovar: !!r.aprovar, excluir: !!r.excluir }));
    return p;
}

async function salvarPermissoes(id, perm = {}) {
    await q("DELETE FROM permissoes WHERE usuario_id = ?", [id]);
    for (const m of MODULOS) {
        const p = perm[m];
        if (p && ACOES.some((a) => p[a]))
            await q(
                "INSERT INTO permissoes (usuario_id, modulo, ver, editar, aprovar, excluir) VALUES (?, ?, ?, ?, ?, ?)",
                [id, m, !!p.ver, !!p.editar, !!p.aprovar, !!p.excluir]
            );
    }
}

const log = (uid, acao) => q("INSERT INTO admin_log (usuario_id, acao) VALUES (?, ?)", [uid, acao]).catch(() => {});

// Identifica quem chama (a partir do token) e exige admin ou master
router.use(h(async (req, res, next) => {
    const id = idDoToken(req);
    if (!id) return res.status(401).json({ erro: "Sessão inválida. Entre novamente." });
    const rows = await q("SELECT id, role, arquivado_em FROM usuarios WHERE id = ?", [id]);
    const eu = rows && rows[0];
    if (!eu || !["admin", "master"].includes(eu.role)) return res.status(403).json({ erro: "Acesso restrito a administradores." });
    // Conta arquivada perde o acesso na hora, mesmo com token ainda válido
    if (eu.arquivado_em) return res.status(403).json({ erro: "Esta conta foi arquivada." });
    req._eu = eu;
    next();
}));

const soMaster = (req, res, next) =>
    req._eu.role === "master" ? next() : res.status(403).json({ erro: "Apenas o Admin Master pode fazer isso." });

// Quem sou eu + minhas permissões (o painel usa para esconder menus e botões)
router.get("/acesso", h(async (req, res) => {
    const [u] = await q("SELECT id, nome_completo, email, role, cargo FROM usuarios WHERE id = ?", [req._eu.id]);
    u.permissoes = u.role === "master" ? {} : await carregarPermissoes(u.id);
    res.json(u);
}));

// ── AUDITORIA (só master): histórico de ações dos administradores ──
router.get("/auditoria", soMaster, h(async (req, res) => {
    const limite = Math.min(Math.max(parseInt(req.query.limite, 10) || 200, 1), 500);
    const rows = await q(
        `SELECT l.id, l.usuario_id, l.acao, l.criado_em, u.nome_completo, u.email
         FROM admin_log l
         LEFT JOIN usuarios u ON u.id = l.usuario_id
         ORDER BY l.criado_em DESC, l.id DESC
         LIMIT ${limite}`
    );
    res.json(rows);
}));

// ── BUSCA GLOBAL (Ctrl K): só procura nos módulos que a pessoa pode ver ──
// Itens arquivados não aparecem na busca.
router.get("/busca", h(async (req, res) => {
    const termo = String(req.query.q || "").trim().slice(0, 60);
    if (termo.length < 2) return res.json({ usuarios: [], eventos: [], estabelecimentos: [], mensagens: [], pedidos: [] });

    const master = req._eu.role === "master";
    const perm = master ? {} : await carregarPermissoes(req._eu.id);
    const pode = (m) => master || !!(perm[m] && perm[m].ver);
    const like = `%${termo.toLowerCase()}%`;
    const idNum = /^\d+$/.test(termo) ? Number(termo) : -1;

    // Se uma consulta falhar, as outras continuam funcionando
    const buscar = async (modulo, sql, params) => {
        if (!pode(modulo)) return [];
        try {
            return await q(sql, params);
        } catch (e) {
            console.error("busca", modulo, e.message);
            return [];
        }
    };

    const [usuarios, eventos, estabelecimentos, mensagens, pedidos] = await Promise.all([
        buscar("usuarios",
            "SELECT id, nome_completo, email, role, verificado FROM usuarios WHERE arquivado_em IS NULL AND (id = ? OR LOWER(nome_completo) LIKE ? OR LOWER(email) LIKE ?) ORDER BY id DESC LIMIT 5",
            [idNum, like, like]),
        buscar("eventos",
            "SELECT id, nome, nome_produtor, status_aprovacao FROM eventos WHERE arquivado_em IS NULL AND (id = ? OR LOWER(nome) LIKE ? OR LOWER(nome_produtor) LIKE ?) ORDER BY id DESC LIMIT 5",
            [idNum, like, like]),
        buscar("estabelecimentos",
            "SELECT id, nome, cidade, status_aprovacao FROM estabelecimentos WHERE arquivado_em IS NULL AND (id = ? OR LOWER(nome) LIKE ? OR LOWER(cidade) LIKE ?) ORDER BY id DESC LIMIT 5",
            [idNum, like, like]),
        buscar("mensagens",
            "SELECT * FROM contatos WHERE arquivado_em IS NULL AND (id = ? OR LOWER(nome) LIKE ? OR LOWER(email) LIKE ? OR LOWER(assunto) LIKE ?) ORDER BY id DESC LIMIT 5",
            [idNum, like, like, like]),
        buscar("pedidos",
            `SELECT p.id, p.valor_total, p.status, u.nome_completo, e.nome AS evento_nome
             FROM pedidos p
             LEFT JOIN usuarios u ON u.id = p.usuario_id
             LEFT JOIN eventos e ON e.id = p.evento_id
             WHERE p.id = ? OR LOWER(u.nome_completo) LIKE ? OR LOWER(u.email) LIKE ? OR LOWER(e.nome) LIKE ?
             ORDER BY p.id DESC LIMIT 5`,
            [idNum, like, like, like]),
    ]);
    res.json({ usuarios, eventos, estabelecimentos, mensagens, pedidos });
}));


// ── FICHA DO USUÁRIO (consulta para o suporte) ──
// Uma chamada só: dados da conta, resumo, pedidos, mensagens e linha do tempo.
// Pedidos e mensagens só vêm se a pessoa tiver permissão de ver esses módulos.
// Nunca devolve senha nem códigos; o CPF vai mascarado.
router.get("/usuarios/:id/ficha", h(async (req, res) => {
    const id = req.params.id;
    if (!/^\d+$/.test(id)) return res.status(400).json({ erro: "Id inválido." });

    const master = req._eu.role === "master";
    const perm = master ? {} : await carregarPermissoes(req._eu.id);
    const pode = (m) => master || !!(perm[m] && perm[m].ver);
    if (!pode("usuarios")) return res.status(403).json({ erro: "Sem permissão para ver usuários." });

    const u = (await q(
        `SELECT id, nome_completo, email, telefone, cpf, role, cargo, verificado, cidade, estado,
                criado_em, tentativas_login, bloqueado_ate, arquivado_em
         FROM usuarios WHERE id = ?`,
        [id]
    ))[0];
    if (!u) return res.status(404).json({ erro: "Usuário não encontrado." });

    const cpf = String(u.cpf || "").replace(/\D/g, "");
    u.cpf_mascarado = cpf.length === 11 ? "***.***.***-" + cpf.slice(9) : null;
    delete u.cpf;

    let pedidos = null, resumo = null;
    if (pode("pedidos")) {
        try {
            pedidos = await q(
                `SELECT p.id, p.status, p.valor_total, p.forma_pagamento, p.criado_em, p.atualizado_em,
                        e.nome AS evento_nome,
                        (SELECT COALESCE(SUM(v.quantidade), 0) FROM vendas v WHERE v.pedido_id = p.id) AS quantidade
                 FROM pedidos p
                 LEFT JOIN eventos e ON e.id = p.evento_id
                 WHERE p.usuario_id = ?
                 ORDER BY p.criado_em DESC
                 LIMIT 20`,
                [id]
            );
            const por = await q(
                "SELECT status, COUNT(*) AS n, COALESCE(SUM(valor_total), 0) AS valor FROM pedidos WHERE usuario_id = ? GROUP BY status",
                [id]
            );
            const ativos = await q(
                `SELECT COALESCE(SUM(v.quantidade), 0) AS total
                 FROM vendas v
                 JOIN pedidos p ON p.id = v.pedido_id
                 JOIN eventos e ON e.id = p.evento_id
                 WHERE p.usuario_id = ? AND v.status IN ('aprovado', 'cortesia')
                   AND COALESCE(e.data_fim, e.data_inicio) >= NOW()`,
                [id]
            );
            const n = (st) => Number((por.find((r) => r.status === st) || {}).n) || 0;
            resumo = {
                pedidos: por.reduce((s, r) => s + (Number(r.n) || 0), 0),
                pago: Number((por.find((r) => r.status === "aprovado") || {}).valor) || 0,
                cancelados: n("cancelado"),
                reembolsos: n("reembolsado"),
                ingressos_ativos: Number(ativos[0] && ativos[0].total) || 0,
            };
        } catch (e) {
            console.error("ficha pedidos:", e.message);
            pedidos = null;
            resumo = null;
        }
    }

    let mensagens = null;
    if (pode("mensagens") && u.email) {
        try {
            mensagens = await q(
                "SELECT id, assunto, tipo, status, criado_em FROM contatos WHERE arquivado_em IS NULL AND LOWER(email) = LOWER(?) ORDER BY criado_em DESC LIMIT 10",
                [u.email]
            );
        } catch (e) {
            console.error("ficha mensagens:", e.message);
            mensagens = null;
        }
    }

    const tl = [];
    if (u.criado_em) tl.push({ em: u.criado_em, texto: "Conta criada" });
    (pedidos || []).forEach((p) => {
        tl.push({ em: p.criado_em, texto: `Pedido #${p.id} criado (${p.evento_nome || "evento"})` });
        if (["cancelado", "reembolsado"].includes(p.status) && p.atualizado_em)
            tl.push({ em: p.atualizado_em, texto: `Pedido #${p.id} ${p.status === "cancelado" ? "cancelado" : "reembolsado"}` });
    });
    (mensagens || []).forEach((m) =>
        tl.push({ em: m.criado_em, texto: `Mensagem recebida: "${String(m.assunto || "sem assunto").slice(0, 60)}"` })
    );
    tl.sort((a, b) => new Date(b.em) - new Date(a.em));

    res.json({ usuario: u, resumo, pedidos, mensagens, linha_tempo: tl.slice(0, 15) });
}));

// ── ATRIBUIÇÃO DE TAREFAS: quem está cuidando de qual mensagem ou cadastro ──
// Tabela: atribuicoes (tipo, ref_id, usuario_id). Um item só pode estar com uma pessoa.
const TIPO_ATRIB = { mensagem: "mensagens", evento: "eventos", local: "estabelecimentos" };

router.get("/atribuicoes", h(async (req, res) => {
    const rows = await q(
        `SELECT a.tipo, a.ref_id, a.usuario_id, a.criado_em, u.nome_completo
         FROM atribuicoes a
         LEFT JOIN usuarios u ON u.id = a.usuario_id`
    );
    res.json(rows);
}));

router.put("/atribuicoes", h(async (req, res) => {
    const { tipo, acao } = req.body;
    const refId = Number(req.body.ref_id);
    const modulo = TIPO_ATRIB[tipo];
    if (!modulo || !Number.isInteger(refId) || refId < 1) return res.status(400).json({ erro: "Tarefa inválida." });

    const master = req._eu.role === "master";
    if (!master) {
        const perm = (await carregarPermissoes(req._eu.id))[modulo];
        if (!perm || !perm.ver) return res.status(403).json({ erro: "Sem permissão para esta tarefa." });
    }

    const atual = (await q("SELECT usuario_id FROM atribuicoes WHERE tipo = ? AND ref_id = ?", [tipo, refId]))[0];

    if (acao === "assumir") {
        if (atual) {
            if (String(atual.usuario_id) === String(req._eu.id)) return res.json({ mensagem: "A tarefa já está com você." });
            return res.status(409).json({ erro: "Esta tarefa já está com outra pessoa." });
        }
        try {
            await q("INSERT INTO atribuicoes (tipo, ref_id, usuario_id) VALUES (?, ?, ?)", [tipo, refId, req._eu.id]);
        } catch {
            return res.status(409).json({ erro: "Esta tarefa acabou de ser assumida por outra pessoa." });
        }
        log(req._eu.id, `Assumiu ${tipo} #${refId}`);
        return res.json({ mensagem: "Tarefa assumida." });
    }

    if (acao === "soltar") {
        if (!atual) return res.json({ mensagem: "A tarefa já estava livre." });
        if (!master && String(atual.usuario_id) !== String(req._eu.id))
            return res.status(403).json({ erro: "Só quem assumiu a tarefa (ou o Master) pode liberá-la." });
        await q("DELETE FROM atribuicoes WHERE tipo = ? AND ref_id = ?", [tipo, refId]);
        log(req._eu.id, `Liberou ${tipo} #${refId}`);
        return res.json({ mensagem: "Tarefa liberada." });
    }

    if (acao === "atribuir") {
        if (!master) return res.status(403).json({ erro: "Apenas o Admin Master pode atribuir tarefas a outras pessoas." });
        const alvoId = Number(req.body.usuario_id);
        if (!Number.isInteger(alvoId) || alvoId < 1) return res.status(400).json({ erro: "Escolha um administrador." });
        const alvo = (await q("SELECT id, nome_completo, role FROM usuarios WHERE id = ?", [alvoId]))[0];
        if (!alvo || !["admin", "master"].includes(alvo.role)) return res.status(400).json({ erro: "Escolha um administrador." });
        if (atual) await q("UPDATE atribuicoes SET usuario_id = ? WHERE tipo = ? AND ref_id = ?", [alvoId, tipo, refId]);
        else await q("INSERT INTO atribuicoes (tipo, ref_id, usuario_id) VALUES (?, ?, ?)", [tipo, refId, alvoId]);
        log(req._eu.id, `Atribuiu ${tipo} #${refId} a ${alvo.nome_completo || "#" + alvoId}`);
        return res.json({ mensagem: "Tarefa atribuída." });
    }

    res.status(400).json({ erro: "Ação inválida." });
}));

// ── EQUIPE (só master) ──
router.get("/equipe", soMaster, h(async (req, res) => {
    const admins = await q("SELECT id, nome_completo, email, role, cargo FROM usuarios WHERE role IN ('admin','master') ORDER BY (role = 'master') DESC, nome_completo");
    for (const a of admins) a.permissoes = a.role === "master" ? {} : await carregarPermissoes(a.id);
    res.json(admins);
}));

// Permissões atuais de um administrador (a tela Equipe usa para mostrar os toggles)
router.get("/equipe/:id/permissoes", soMaster, h(async (req, res) => {
    const rows = await q("SELECT role FROM usuarios WHERE id = ?", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ erro: "Usuário não encontrado." });
    res.json({ permissoes: rows[0].role === "master" ? {} : await carregarPermissoes(req.params.id) });
}));

router.post("/equipe", soMaster, h(async (req, res) => {
    const { email, cargo, permissoes } = req.body;
    const rows = await q("SELECT id, role FROM usuarios WHERE LOWER(email) = LOWER(?)", [email || ""]);
    const u = rows && rows[0];
    if (!u) return res.status(404).json({ erro: "Nenhum usuário com esse e-mail. Peça para a pessoa criar conta no site primeiro." });
    if (u.role === "master") return res.status(400).json({ erro: "Este usuário já é Master." });
    await q("UPDATE usuarios SET role = 'admin', cargo = ? WHERE id = ?", [cargo || "Personalizado", u.id]);
    await salvarPermissoes(u.id, permissoes);
    log(req._eu.id, `Adicionou ${email} como administrador (${cargo})`);
    res.json({ mensagem: "Administrador adicionado." });
}));

router.put("/equipe/:id/permissoes", soMaster, h(async (req, res) => {
    const rows = await q("SELECT role FROM usuarios WHERE id = ?", [req.params.id]);
    if (!rows[0] || rows[0].role !== "admin") return res.status(400).json({ erro: "Só é possível editar administradores comuns." });
    // Sem o objeto de permissões não há o que salvar (evita apagar tudo por engano)
    if (!req.body.permissoes || typeof req.body.permissoes !== "object")
        return res.status(400).json({ erro: "Permissões não informadas." });
    // O cargo só muda se vier na requisição; senão mantém o que já existe
    if (req.body.cargo) await q("UPDATE usuarios SET cargo = ? WHERE id = ?", [req.body.cargo, req.params.id]);
    await salvarPermissoes(req.params.id, req.body.permissoes);
    log(req._eu.id, `Alterou permissões do usuário #${req.params.id}`);
    res.json({ mensagem: "Permissões salvas." });
}));

router.delete("/equipe/:id", soMaster, h(async (req, res) => {
    const rows = await q("SELECT role FROM usuarios WHERE id = ?", [req.params.id]);
    if (!rows[0] || rows[0].role !== "admin") return res.status(400).json({ erro: "Só é possível remover administradores comuns." });
    await q("UPDATE usuarios SET role = 'user', cargo = NULL WHERE id = ?", [req.params.id]);
    await q("DELETE FROM permissoes WHERE usuario_id = ?", [req.params.id]);
    log(req._eu.id, `Removeu o admin #${req.params.id}`);
    res.json({ mensagem: "Administrador removido." });
}));

// ── Texto legível para o histórico de auditoria ──
const ROTULO = {
    usuarios: "usuário", estabelecimentos: "local", eventos: "evento",
    avaliacoes: "avaliação", ingressos: "ingresso", pedidos: "pedido", mensagens: "mensagem",
};
const NOME_COL = {
    usuarios: ["usuarios", "nome_completo"], estabelecimentos: ["estabelecimentos", "nome"],
    eventos: ["eventos", "nome"], ingressos: ["ingressos", "titulo"],
};

// Busca o nome do registro ANTES da ação (assim o nome já está guardado no histórico)
async function nomeDoAlvo(modulo, id) {
    const c = NOME_COL[modulo];
    if (!c || !/^\d+$/.test(String(id || ""))) return "";
    try {
        const r = (await q(`SELECT ${c[1]} AS nome FROM ${c[0]} WHERE id = ?`, [id]))[0];
        return r && r.nome ? String(r.nome).slice(0, 60) : "";
    } catch {
        return "";
    }
}

function descrever(req, modulo, id, sub, nome) {
    const rot = ROTULO[modulo] || modulo;
    const alvo = `${rot}${/^\d+$/.test(String(id || "")) ? " #" + id : ""}${nome ? ` "${nome}"` : ""}`;
    const body = req.body || {};
    if (sub === "arquivar") {
        const motivo = body.motivo ? ` (motivo: ${String(body.motivo).trim().slice(0, 100)})` : "";
        return `Arquivou ${alvo}${motivo}`;
    }
    if (sub === "restaurar") return `Restaurou ${alvo}`;
    if (sub === "status") {
        const v = (modulo === "pedidos" && body.status === "aprovado")
            ? "Confirmou o pagamento de"
            : { aprovado: "Aprovou", bloqueado: "Recusou", pendente: "Colocou em pendente", cancelado: "Cancelou", reembolsado: "Reembolsou" }[body.status] || "Alterou o status de";
        const motivo = body.motivo ? ` (motivo: ${String(body.motivo).trim().slice(0, 100)})` : "";
        return `${v} ${alvo}${motivo}`;
    }
        if (sub === "desbloquear") return `Desbloqueou o login de ${alvo}`;
    if (sub === "reenviar-codigo") return `Reenviou o código de verificação de ${alvo}`;
        if (sub === "reenviar-ingresso") return `Reenviou o ingresso do ${alvo}`;
    if (sub === "role") return `Alterou o cargo de ${alvo} para ${String(body.role)}`;
    if (sub === "responder") return `Respondeu a ${alvo}`;
    const verbo = { PUT: "Editou", POST: "Criou", DELETE: "Excluiu" }[req.method] || req.method;
    return `${verbo} ${alvo}`;
}

// Módulos de dados: nada disso é excluído de verdade, só arquivado
const SEM_EXCLUSAO = ["usuarios", "estabelecimentos", "eventos", "avaliacoes", "ingressos", "mensagens", "pedidos"];
// Tipo de atribuição de tarefa de cada módulo (para liberar a tarefa quando ela some da fila)
const TIPO_TAREFA = { eventos: "evento", estabelecimentos: "local", mensagens: "mensagem" };

// ── AUTORIZAÇÃO das rotas /admin que já existem (um middleware só) ──
const autorizar = h(async (req, res, next) => {
    const [, modulo, id, sub] = req.path.split("/");   // ex.: /eventos/12/status
    if (["dashboard", "perfil", "acesso", "equipe"].includes(modulo)) return next();
    const master = req._eu.role === "master";

    // Nada é apagado: quem tentar DELETE é orientado a arquivar
    if (req.method === "DELETE" && SEM_EXCLUSAO.includes(modulo))
        return res.status(405).json({ erro: "Exclusão desativada: os dados são arquivados. Use Arquivar." });

    // Restaurar itens arquivados é só do Master
    if (sub === "restaurar" && !master)
        return res.status(403).json({ erro: "Apenas o Admin Master pode restaurar itens arquivados." });

    if (modulo === "usuarios") {
        if (!master && sub === "role") return res.status(403).json({ erro: "Apenas o Admin Master pode alterar cargos." });
        if (!master && req.body && "role" in req.body) delete req.body.role;   // admin comum não se promove
        if (id && req.method !== "GET") {
            const alvo = (await q("SELECT role FROM usuarios WHERE id = ?", [id]))[0];
            if (alvo && alvo.role === "master") {
               if (!master || req.method === "DELETE" || sub === "role" || sub === "arquivar" || sub === "suspender")
                    return res.status(403).json({ erro: "A conta Master não pode ser alterada por aqui." });
                if (req.body) delete req.body.role;                            // editar Master nunca muda o cargo
            }
            // Contas de administrador (inclusive a própria) só o Master altera ou arquiva
            if (alvo && alvo.role === "admin" && !master)
                return res.status(403).json({ erro: "Apenas o Admin Master pode alterar ou arquivar contas de administrador." });
            // Ninguém arquiva a própria conta pelo painel
            if ((sub === "arquivar" || sub === "suspender") && String(id) === String(req._eu.id))
    return res.status(403).json({ erro: "Você não pode arquivar ou suspender a própria conta." });
        }
    }

    if (!master) {
        if (!MODULOS.includes(modulo)) return res.status(403).json({ erro: "Sem permissão." });
        // Arquivar usa a permissão "excluir" do módulo
        const acao = req.method === "GET" ? "ver" : sub === "arquivar" ? "excluir"
            : sub === "status" ? "aprovar" : sub === "lido" ? "ver" : "editar";
        const perm = (await carregarPermissoes(req._eu.id))[modulo];
        if (!perm || !perm[acao]) return res.status(403).json({ erro: `Sem permissão para ${acao} em ${modulo}.` });
    }

    if (req.method !== "GET" && sub !== "lido") {
        const nome = await nomeDoAlvo(modulo, id);
        const descricao = descrever(req, modulo, id, sub, nome).slice(0, 250);
        // Tarefa concluída (cadastro decidido, mensagem respondida ou item arquivado): libera a atribuição
        const tipoAtrib = TIPO_TAREFA[modulo] && (
            (sub === "status" && modulo !== "mensagens") ||
            (sub === "responder" && modulo === "mensagens") ||
            sub === "arquivar"
        ) ? TIPO_TAREFA[modulo] : null;
        res.on("finish", () => {
            if (res.statusCode >= 400) return;
            log(req._eu.id, descricao);
            if (tipoAtrib && /^\d+$/.test(String(id || "")))
                q("DELETE FROM atribuicoes WHERE tipo = ? AND ref_id = ?", [tipoAtrib, id]).catch(() => {});
        });
    }
    next();
});

module.exports = { rotas: router, autorizar };