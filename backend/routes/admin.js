// =====================================================
//  backend/routes/admin.js
//  A checagem de permissão por módulo fica em adminAcesso.js (autorizar)
//
//  ARQUIVAMENTO: nada é excluído de verdade. As listagens escondem os itens
//  arquivados (arquivado_em IS NULL) e as rotas DELETE foram removidas.
//  Arquivar e restaurar ficam em adminArquivo.js.
// =====================================================
const { randomInt } = require("crypto");
const express = require("express");
const router = express.Router();
const authAdmin = require("../middleware/authAdmin");
const connection = require("../db/db_config");
const nodemailer = require("nodemailer");
const { wrapEmail, logoAttachment } = require("../services/emailTemplate");
const { STATUS_APROVACAO } = require("../utils/aprovacao");

// Escapa texto vindo de usuário antes de colocar em HTML de e-mail
function escHtml(s) {
    return String(s == null ? "" : s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// ── Transporter (mesmo do contato.js) ───────────────
const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    family: 4,
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// Consulta em formato Promise (usa o mesmo connection das rotas em callback)
const consulta = (sql, params = []) =>
    new Promise((resolve, reject) =>
        connection.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)))
    );

// Avisa o produtor por e-mail que o cadastro foi recusado, com o motivo.
// Devolve true se o e-mail saiu, false se não deu para avisar.
async function avisarRecusa(tabela, id, motivo) {
    const rows = await consulta(`SELECT * FROM ${tabela} WHERE id = ?`, [id]);
    const item = rows[0];
    if (!item || !item.usuario_id) return false;
    const us = await consulta("SELECT nome_completo, email FROM usuarios WHERE id = ?", [item.usuario_id]);
    const produtor = us[0];
    if (!produtor || !produtor.email) return false;

    const rotulo = tabela === "eventos" ? "evento" : "local";
    await transporter.sendMail({
        from: `"Rolês Suporte" <${process.env.EMAIL_USER}>`,
        to: produtor.email,
        subject: `Seu ${rotulo} não foi aprovado`,
        html: wrapEmail(`
      <tr><td style="padding:40px;">
        <h2 style="color:#1a1a2e;margin:0 0 12px;font-size:22px;">Cadastro não aprovado</h2>
        <p style="color:#333;font-size:15px;margin:0 0 8px;">Olá, <strong>${escHtml(produtor.nome_completo || "")}</strong>!</p>
        <p style="color:#555;font-size:14px;margin:0 0 20px;line-height:1.6;">
          Analisamos o cadastro do ${rotulo} <strong>${escHtml(item.nome)}</strong> e, por enquanto, ele não foi aprovado.
        </p>
        <p style="color:#999;font-size:12px;margin:0 0 8px;">Motivo informado pela nossa equipe:</p>
        <div style="background:#f5f0ff;border-left:4px solid #6c2bd9;border-radius:8px;padding:20px;margin-bottom:24px;font-size:14px;color:#333;line-height:1.7;">
          ${escHtml(motivo).replace(/\n/g, "<br>")}
        </div>
        <p style="color:#555;font-size:13px;margin:0;line-height:1.6;">Se tiver dúvidas, fale com a nossa equipe pelo formulário de contato do Rolês.</p>
      </td></tr>
    `),
        attachments: [logoAttachment],
    });
    return true;
}

// ─────────────────────────────────────────────────────
// DASHBOARD (os contadores ignoram itens arquivados)
// ─────────────────────────────────────────────────────
router.get("/dashboard", authAdmin, (req, res) => {
    const queries = {
        usuarios: "SELECT COUNT(*) as total FROM usuarios WHERE arquivado_em IS NULL",
        estabelecimentos: "SELECT COUNT(*) as total FROM estabelecimentos WHERE arquivado_em IS NULL",
        eventos: "SELECT COUNT(*) as total FROM eventos WHERE arquivado_em IS NULL",
        avaliacoes: "SELECT COUNT(*) as total FROM avaliacoes WHERE arquivado_em IS NULL",
        ingressos: "SELECT COUNT(*) as total FROM ingressos WHERE arquivado_em IS NULL",
        mensagens: "SELECT COUNT(*) as total FROM contatos WHERE status = 'novo' AND arquivado_em IS NULL",
    };

    const resultados = {};
    let concluidos = 0;
    const total = Object.keys(queries).length;

    for (const [chave, sql] of Object.entries(queries)) {
        connection.query(sql, [], (err, rows) => {
            resultados[chave] = err ? 0 : rows[0].total;
            concluidos++;
            if (concluidos === total) res.json(resultados);
        });
    }
});

// ─────────────────────────────────────────────────────
// USUÁRIOS
// ─────────────────────────────────────────────────────
router.get("/usuarios", authAdmin, (req, res) => {
    connection.query(
        "SELECT id, nome_completo, email, telefone, role, verificado, criado_em FROM usuarios WHERE arquivado_em IS NULL ORDER BY criado_em DESC",
        [],
        (err, rows) => {
            if (err) return res.status(500).json({ erro: err.message });
            res.json(rows);
        }
    );
});

router.put("/usuarios/:id", authAdmin, (req, res) => {
        const { nome_completo, email, role, verificado } = req.body;
    const verif = [true, 1, "1", "true"].includes(verificado) ? 1 : 0;
    const campos = ["nome_completo = ?", "email = ?", "verificado = ?"];
    const valores = [nome_completo, email, verif];

    // só mexe no cargo se ele veio (o autorizar remove para admin comum e para Master)
    if (role !== undefined && role !== "") {
        if (!["admin", "user"].includes(role)) {
            return res.status(400).json({ erro: "Role inválido." });
        }
        campos.push("role = ?");
        valores.push(role);
    }

    valores.push(req.params.id);
    connection.query(
        `UPDATE usuarios SET ${campos.join(", ")} WHERE id = ?`,
        valores,
        (err) => {
            if (err) return res.status(500).json({ erro: err.message });
            res.json({ mensagem: "Usuário atualizado com sucesso." });
        }
    );
});

router.put("/usuarios/:id/role", authAdmin, (req, res) => {
    const { role } = req.body;
    if (!["admin", "user"].includes(role)) {
        return res.status(400).json({ erro: "Role inválido." });
    }
    connection.query(
        "UPDATE usuarios SET role = ? WHERE id = ?",
        [role, req.params.id],
        (err) => {
            if (err) return res.status(500).json({ erro: err.message });
            res.json({ mensagem: `Usuário atualizado para ${role}.` });
        }
    );
});

// ── Ações de suporte na ficha do usuário ──

// Zera as tentativas erradas e libera o login
router.put("/usuarios/:id/desbloquear", authAdmin, (req, res) => {
    if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ erro: "Id inválido." });
    connection.query(
        "UPDATE usuarios SET tentativas_login = 0, bloqueado_ate = NULL WHERE id = ?",
        [req.params.id],
        (err, result) => {
            if (err) {
                console.error("Erro ao desbloquear login:", err.message);
                return res.status(500).json({ erro: "Erro ao desbloquear o login." });
            }
            if (result && result.affectedRows === 0) return res.status(404).json({ erro: "Usuário não encontrado." });
            res.json({ mensagem: "Login desbloqueado." });
        }
    );
});


// Suspende a conta: bloqueia o login até um administrador reativar ("Reativar conta" usa /desbloquear)
router.put("/usuarios/:id/suspender", authAdmin, (req, res) => {
    if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ erro: "Id inválido." });
    connection.query(
        "UPDATE usuarios SET bloqueado_ate = '2099-12-31 23:59:59', tentativas_login = 0 WHERE id = ? AND role <> 'master'",
        [req.params.id],
        (err, result) => {
            if (err) {
                console.error("Erro ao suspender conta:", err.message);
                return res.status(500).json({ erro: "Erro ao suspender a conta." });
            }
            if (result && result.affectedRows === 0) return res.status(404).json({ erro: "Usuário não encontrado." });
            res.json({ mensagem: "Conta suspensa." });
        }
    );
});
// Gera um código novo e envia por e-mail (só para quem ainda não verificou)
router.post("/usuarios/:id/reenviar-codigo", authAdmin, async (req, res) => {
    if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ erro: "Id inválido." });
    try {
        const us = await consulta("SELECT id, nome_completo, email, verificado FROM usuarios WHERE id = ?", [req.params.id]);
        const u = us[0];
        if (!u) return res.status(404).json({ erro: "Usuário não encontrado." });
        if ([true, 1, "1", "t", "true"].includes(u.verificado)) {
            return res.status(409).json({ erro: "Este usuário já verificou o e-mail." });
        }
        if (!u.email) return res.status(400).json({ erro: "Este usuário não tem e-mail cadastrado." });

        const codigo = String(randomInt(100000, 1000000));

        // Envia primeiro: se o e-mail falhar, o código antigo continua valendo
        try {
            await transporter.sendMail({
                from: `"Rolês Suporte" <${process.env.EMAIL_USER}>`,
                to: u.email,
                subject: "Seu código de verificação - Rolês",
                html: wrapEmail(`
      <tr><td style="padding:40px;text-align:center;">
        <h2 style="color:#1a1a2e;margin:0 0 12px;font-size:22px;">Verificação de conta</h2>
        <p style="color:#555;font-size:15px;margin:0 0 28px;line-height:1.6;">
          Olá, <strong>${escHtml(u.nome_completo || "")}</strong>! Use o código abaixo para ativar sua conta no Rolês:
        </p>
        <div style="background:#f5f0ff;border:2px dashed #6c2bd9;border-radius:16px;padding:28px;display:inline-block;margin-bottom:28px;">
          <span style="font-size:48px;font-weight:700;letter-spacing:12px;color:#6c2bd9;">${codigo}</span>
        </div>
        <p style="color:#999;font-size:13px;margin:0;">Se você não solicitou isso, ignore este e-mail.</p>
      </td></tr>
    `),
                attachments: [logoAttachment],
            });
        } catch (e) {
            console.error("Erro ao reenviar código:", e.message);
            return res.status(502).json({ erro: "Não foi possível enviar o e-mail. Tente de novo em instantes." });
        }

        await consulta("UPDATE usuarios SET codigo_verificacao = ? WHERE id = ?", [codigo, u.id]);
        res.json({ mensagem: "Código enviado.", email_enviado: true });
    } catch (e) {
        console.error("Erro em reenviar-codigo:", e.message);
        res.status(500).json({ erro: "Erro ao reenviar o código." });
    }
});
// ─────────────────────────────────────────────────────
// ESTABELECIMENTOS
// ─────────────────────────────────────────────────────
router.get("/estabelecimentos", authAdmin, (req, res) => {
    connection.query(
        "SELECT id, nome, tipo, cidade, estado, avaliacoes, nota, visibilidade, status_aprovacao, criado_em FROM estabelecimentos WHERE arquivado_em IS NULL ORDER BY criado_em DESC",
        [],
        (err, rows) => {
            if (err) return res.status(500).json({ erro: err.message });
            res.json(rows);
        }
    );
});

router.put("/estabelecimentos/:id", authAdmin, (req, res) => {
    const { nome, tipo, cidade, endereco, descricao } = req.body;
    connection.query(
        "UPDATE estabelecimentos SET nome = ?, tipo = ?, cidade = ?, endereco = ?, descricao = ? WHERE id = ?",
        [nome, tipo, cidade, endereco, descricao, req.params.id],
        (err) => {
            if (err) return res.status(500).json({ erro: err.message });
            res.json({ mensagem: "Estabelecimento atualizado com sucesso." });
        }
    );
});

// ─────────────────────────────────────────────────────
// EVENTOS
// ─────────────────────────────────────────────────────
router.get("/eventos", authAdmin, (req, res) => {
    connection.query(
        "SELECT * FROM eventos WHERE arquivado_em IS NULL ORDER BY criado_em DESC",
        [],
        (err, rows) => {
            if (err) return res.status(500).json({ erro: err.message });
            res.json(rows);
        }
    );
});

router.put("/eventos/:id", authAdmin, (req, res) => {
    const { nome, assunto, categoria, descricao, nome_produtor, local, cidade, estado, cep, rua, data_inicio, data_fim } = req.body;
    const fimFinal = data_fim || data_inicio;
    connection.query(
        `UPDATE eventos SET
            nome = ?, assunto = ?, categoria = ?, descricao = ?, nome_produtor = ?,
            local_nome = ?, cidade = ?, estado = ?, cep = ?, rua = ?,
            data_inicio = ?, data_fim = ?
         WHERE id = ?`,
        [nome, assunto, categoria, descricao, nome_produtor, local, cidade, estado, cep, rua, data_inicio, fimFinal, req.params.id],
        (err) => {
            if (err) return res.status(500).json({ erro: err.message });
            res.json({ mensagem: "Evento atualizado com sucesso." });
        }
    );
});

// ─────────────────────────────────────────────────────
// INGRESSOS (esconde os arquivados e os de eventos arquivados)
// ─────────────────────────────────────────────────────
router.get("/ingressos", authAdmin, (req, res) => {
    connection.query(
        `SELECT i.id, i.titulo, i.tipo, i.valor, i.quantidade_total, i.evento_id,
                e.nome AS evento_nome
         FROM ingressos i
         LEFT JOIN eventos e ON e.id = i.evento_id
         WHERE i.arquivado_em IS NULL AND (e.id IS NULL OR e.arquivado_em IS NULL)
         ORDER BY i.id DESC`,
        [],
        (err, rows) => {
            if (err) return res.status(500).json({ erro: err.message });
            res.json(rows);
        }
    );
});

router.put("/ingressos/:id", authAdmin, (req, res) => {
    const { titulo, tipo, valor, quantidade_total } = req.body;
    connection.query(
        "UPDATE ingressos SET titulo = ?, tipo = ?, valor = ?, quantidade_total = ? WHERE id = ?",
        [titulo, tipo, valor, quantidade_total, req.params.id],
        (err) => {
            if (err) return res.status(500).json({ erro: err.message });
            res.json({ mensagem: "Ingresso atualizado com sucesso." });
        }
    );
});


// ─────────────────────────────────────────────────────
// APROVAÇÃO (eventos e estabelecimentos)
// Só admin muda o status: pendente | aprovado | bloqueado
// ─────────────────────────────────────────────────────
// Marca como reembolsado um pedido pago (usado ao bloquear um evento com vendas)
async function reembolsarPedido(id) {
    await connection.transacao(async (tx) => {
        const peds = await tx.query("SELECT id, status FROM pedidos WHERE id = ? FOR UPDATE", [id]);
        if (!peds[0] || peds[0].status !== "aprovado") throw new Error("Pedido não está pago.");
        const itens = await tx.query(
            "SELECT i.tipo_selecao FROM vendas v JOIN ingressos i ON i.id = v.ingresso_id WHERE v.pedido_id = ?",
            [id]
        );
        await tx.query("UPDATE pedidos SET status = 'reembolsado', atualizado_em = NOW() WHERE id = ?", [id]);
        await tx.query("UPDATE vendas SET status = 'reembolsado' WHERE pedido_id = ?", [id]);
        if (itens.some((it) => it.tipo_selecao === "numerado")) {
            await tx.query("UPDATE assentos SET status = 'disponivel', pedido_id = NULL WHERE pedido_id = ?", [id]);
        }
    });
}

// Só o Master ou quem pode editar Pedidos cancela pedidos ao bloquear um evento
async function podeCancelarPedidos(req) {
    if (!req._eu) return false;
    if (req._eu.role === "master") return true;
    const r = await consulta("SELECT editar FROM permissoes WHERE usuario_id = ? AND modulo = 'pedidos'", [req._eu.id]);
    return !!(r[0] && r[0].editar);
}

function rotaStatus(tabela) {
    return async (req, res) => {
        const { status } = req.body;
        if (!Object.values(STATUS_APROVACAO).includes(status)) {
            return res.status(400).json({ erro: "Status inválido." });
        }
        const motivo = String(req.body.motivo || "").trim();
        if (status === "bloqueado" && motivo.length < 10) {
            return res.status(400).json({ erro: "Informe o motivo da recusa (mínimo de 10 caracteres)." });
        }
        const cancelarPedidos = tabela === "eventos" && status === "bloqueado" && req.body.pedidos === "cancelar";
        if (cancelarPedidos) {
            try {
                if (!(await podeCancelarPedidos(req))) {
                    return res.status(403).json({ erro: "Você não tem permissão para cancelar pedidos." });
                }
            } catch (e) {
                return res.status(500).json({ erro: e.message });
            }
        }
        connection.query(
            `UPDATE ${tabela} SET status_aprovacao = ? WHERE id = ?`,
            [status, req.params.id],
            async (err, result) => {
                if (err) return res.status(500).json({ erro: err.message });
                if (result && result.affectedRows === 0) {
                    return res.status(404).json({ erro: "Cadastro não encontrado." });
                }
                let emailEnviado = null;
                if (status === "bloqueado") {
                    try {
                        emailEnviado = await avisarRecusa(tabela, req.params.id, motivo);
                    } catch (e) {
                        console.error("Erro ao avisar o produtor:", e.message);
                        emailEnviado = false;
                    }
                }

                let reembolsados = 0, falhas = 0, emailsFalhos = 0;
                if (cancelarPedidos) {
                    try {
                        const peds = await consulta("SELECT id FROM pedidos WHERE evento_id = ? AND status = 'aprovado'", [req.params.id]);
                        const motivoPed = `Evento bloqueado pela equipe. ${motivo}`;
                        for (const p of peds) {
                            try {
                                await reembolsarPedido(p.id);
                                reembolsados++;
                                try {
                                    if (!(await avisarPedido(p.id, "reembolsado", motivoPed))) emailsFalhos++;
                                } catch (e) {
                                    emailsFalhos++;
                                }
                            } catch (e) {
                                falhas++;
                                console.error("Erro ao reembolsar pedido", p.id, e.message);
                            }
                        }
                        if (reembolsados && req._eu) {
                            consulta("INSERT INTO admin_log (usuario_id, acao) VALUES (?, ?)", [
                                req._eu.id, `Reembolsou ${reembolsados} pedido(s) ao bloquear o evento #${req.params.id}`,
                            ]).catch(() => {});
                        }
                    } catch (e) {
                        console.error("Erro ao cancelar pedidos do evento:", e.message);
                        falhas++;
                    }
                }

                res.json({
                    mensagem: "Status atualizado.", status_aprovacao: status, email_enviado: emailEnviado,
                    pedidos_reembolsados: reembolsados, pedidos_falhas: falhas, emails_falhos: emailsFalhos,
                });
            }
        );
    };
}
// Detalhe completo de um cadastro (usado na fila de aprovação)
function rotaDetalhe(tabela, comIngressos) {
    return async (req, res) => {
        if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ erro: "Id inválido." });
        try {
            const rows = await consulta(`SELECT * FROM ${tabela} WHERE id = ?`, [req.params.id]);
            if (!rows.length) return res.status(404).json({ erro: "Cadastro não encontrado." });
            const item = rows[0];

            let produtor = null;
            if (item.usuario_id) {
                const us = await consulta("SELECT nome_completo, email FROM usuarios WHERE id = ?", [item.usuario_id]);
                produtor = us[0] || null;
            }

            // Duplicado só conta cadastros ativos (os arquivados não entram)
            const dup = await consulta(
                `SELECT COUNT(*) AS n FROM ${tabela} WHERE LOWER(nome) = LOWER(?) AND id <> ? AND arquivado_em IS NULL`,
                [item.nome || "", item.id]
            );

            const out = { ...item, produtor, duplicados: Number((dup[0] && dup[0].n) || 0) };
            if (comIngressos) {
                out.ingressos = await consulta(
                    "SELECT id, titulo, tipo, valor, quantidade_total FROM ingressos WHERE evento_id = ? AND arquivado_em IS NULL ORDER BY id",
                    [item.id]
                );
            }
            res.json(out);
        } catch (e) {
            res.status(500).json({ erro: e.message });
        }
    };
}

// Quantos pedidos pagos o evento tem (o painel avisa antes de bloquear)
router.get("/eventos/:id/vendas", authAdmin, async (req, res) => {
    if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ erro: "Id inválido." });
    try {
        const r = await consulta(
            "SELECT COUNT(*) AS n, COALESCE(SUM(valor_total), 0) AS valor FROM pedidos WHERE evento_id = ? AND status = 'aprovado'",
            [req.params.id]
        );
        res.json({ pedidos_pagos: Number(r[0].n) || 0, valor: Number(r[0].valor) || 0 });
    } catch (e) {
        res.status(500).json({ erro: e.message });
    }
});
router.put("/eventos/:id/status", authAdmin, rotaStatus("eventos"));
router.put("/estabelecimentos/:id/status", authAdmin, rotaStatus("estabelecimentos"));

router.get("/eventos/:id", authAdmin, rotaDetalhe("eventos", true));
router.get("/estabelecimentos/:id", authAdmin, rotaDetalhe("estabelecimentos", false));

// ─────────────────────────────────────────────────────
// PEDIDOS (histórico financeiro: nunca arquivado nem excluído, só cancelado ou reembolsado)
// ─────────────────────────────────────────────────────

// Listar pedidos
// Status gravados pelo sistema de compra: aprovado, pendente (boleto) e cortesia.
router.get("/pedidos", authAdmin, (req, res) => {
    connection.query(
        `SELECT p.*, u.nome_completo, u.email, e.nome AS evento_nome,
                (SELECT COALESCE(SUM(v.quantidade), 0) FROM vendas v WHERE v.pedido_id = p.id) AS quantidade
         FROM pedidos p
         LEFT JOIN usuarios u ON u.id = p.usuario_id
         LEFT JOIN eventos e ON e.id = p.evento_id
         ORDER BY p.criado_em DESC`,
        [],
        (err, rows) => {
            if (err) return res.status(500).json({ erro: err.message });
            res.json(rows);
        }
    );
});

// Resumo financeiro operacional para a Visão geral (pendências e movimento recente).
// Precisa vir ANTES de /pedidos/:id
router.get("/pedidos/resumo", authAdmin, async (req, res) => {
    const dias = Math.min(Math.max(parseInt(req.query.dias, 10) || 30, 1), 90);
    const DIA = 86400000;
    const agora = Date.now();
    const ini = new Date(agora - dias * DIA);
    const ult24 = new Date(agora - DIA);

    try {
        const [pend, periodo, recentes] = await Promise.all([
            consulta("SELECT COUNT(*) AS n, COALESCE(SUM(valor_total), 0) AS valor, MIN(criado_em) AS mais_antigo FROM pedidos WHERE status = 'pendente'"),
            consulta("SELECT status, COUNT(*) AS pedidos, COALESCE(SUM(valor_total), 0) AS valor FROM pedidos WHERE criado_em >= ? GROUP BY status", [ini]),
            consulta("SELECT status, COUNT(*) AS pedidos FROM pedidos WHERE criado_em >= ? GROUP BY status", [ult24]),
        ]);

        const porStatus = {};
        periodo.forEach((r) => { porStatus[r.status] = { pedidos: Number(r.pedidos) || 0, valor: Number(r.valor) || 0 }; });

        const rec = {};
        let total24 = 0;
        recentes.forEach((r) => { rec[r.status] = Number(r.pedidos) || 0; total24 += rec[r.status]; });

        const p = pend[0] || {};
        res.json({
            dias,
            pendentes: { n: Number(p.n) || 0, valor: Number(p.valor) || 0, mais_antigo: p.mais_antigo || null },
            ultimas_24h: { total: total24, por_status: rec },
            por_status: porStatus,
        });
    } catch (e) {
        console.error("Erro no resumo financeiro:", e.message);
        res.status(500).json({ erro: e.message });
    }
});

// Detalhe de um pedido (comprador, evento e itens)
router.get("/pedidos/:id", authAdmin, async (req, res) => {
    if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ erro: "Id inválido." });
    try {
        const rows = await consulta(
            `SELECT p.*, u.nome_completo, u.email, e.nome AS evento_nome
             FROM pedidos p
             LEFT JOIN usuarios u ON u.id = p.usuario_id
             LEFT JOIN eventos e ON e.id = p.evento_id
             WHERE p.id = ?`,
            [req.params.id]
        );
        if (!rows.length) return res.status(404).json({ erro: "Pedido não encontrado." });
        const itens = await consulta(
            `SELECT v.id, v.quantidade, v.valor_total, v.status, v.assento_id, i.titulo, i.tipo
             FROM vendas v
             LEFT JOIN ingressos i ON i.id = v.ingresso_id
             WHERE v.pedido_id = ?
             ORDER BY v.id`,
            [req.params.id]
        );
        res.json({ ...rows[0], itens });
    } catch (e) {
        res.status(500).json({ erro: e.message });
    }
});

// Avisa o comprador por e-mail: ingresso (pagamento confirmado) ou cancelamento/reembolso.
// Devolve true se o e-mail saiu, false se não deu para enviar.
async function avisarPedido(id, tipo, motivo) {
    const rows = await consulta(
        `SELECT p.id, p.usuario_id, p.valor_total, p.forma_pagamento,
                e.nome AS evento_nome, e.data_inicio, e.local_nome, e.cidade,
                u.nome_completo, u.email
         FROM pedidos p
         JOIN eventos e ON e.id = p.evento_id
         JOIN usuarios u ON u.id = p.usuario_id
         WHERE p.id = ?`,
        [id]
    );
    const p = rows[0];
    if (!p || !p.email) return false;
    const valor = Number(p.valor_total) || 0;

    if (tipo === "confirmado") {
        const itens = await consulta(
            "SELECT i.titulo, v.quantidade FROM vendas v JOIN ingressos i ON i.id = v.ingresso_id WHERE v.pedido_id = ?",
            [id]
        );
        const { enviarEmailIngresso } = require("../services/emailService");
        const d = new Date(p.data_inicio);
        const codigo = `ROLES-PEDIDO-${p.id}-USUARIO-${p.usuario_id}`;
        const ingressos = itens.flatMap((it) =>
            Array.from({ length: Number(it.quantidade) || 1 }, () => ({ tipo: it.titulo, codigo_qr: codigo }))
        );
        await enviarEmailIngresso({
            nomeCliente: p.nome_completo,
            emailCliente: p.email,
            pedido_id: p.id,
            nomeEvento: p.evento_nome,
            dataEvento: d.toLocaleDateString("pt-BR"),
            horaEvento: d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
            localEvento: `${p.local_nome}, ${p.cidade}`,
            nomeIngresso: (itens[0] && itens[0].titulo) || "Ingresso",
            quantidade: ingressos.length,
            subtotal: valor,
            taxaServico: valor * 0.10,
            totalPago: valor * 1.10,
            forma_pagamento: p.forma_pagamento,
            ingressos,
        });
        return true;
    }

    const cancelado = tipo === "cancelado";
    const valorTxt = "R$ " + valor.toFixed(2).replace(".", ",");
    await transporter.sendMail({
        from: `"Rolês Suporte" <${process.env.EMAIL_USER}>`,
        to: p.email,
        subject: cancelado ? `Seu pedido #${p.id} foi cancelado` : `Seu pedido #${p.id} foi reembolsado`,
        html: wrapEmail(`
      <tr><td style="padding:40px;">
        <h2 style="color:#1a1a2e;margin:0 0 12px;font-size:22px;">${cancelado ? "Pedido cancelado" : "Pedido reembolsado"}</h2>
        <p style="color:#333;font-size:15px;margin:0 0 8px;">Olá, <strong>${escHtml(p.nome_completo || "")}</strong>!</p>
        <p style="color:#555;font-size:14px;margin:0 0 20px;line-height:1.6;">
          O pedido <strong>#${escHtml(p.id)}</strong> do evento <strong>${escHtml(p.evento_nome)}</strong> (${escHtml(valorTxt)})
          foi ${cancelado ? "cancelado" : "marcado como reembolsado"} pela nossa equipe.
        </p>
        <p style="color:#999;font-size:12px;margin:0 0 8px;">Motivo informado:</p>
        <div style="background:#f5f0ff;border-left:4px solid #6c2bd9;border-radius:8px;padding:20px;margin-bottom:24px;font-size:14px;color:#333;line-height:1.7;">
          ${escHtml(motivo).replace(/\n/g, "<br>")}
        </div>
        <p style="color:#555;font-size:13px;margin:0;line-height:1.6;">
          Os ingressos deste pedido deixam de ser válidos.
          ${cancelado ? "" : "Em caso de dúvidas sobre a devolução do valor, "}
          ${cancelado ? "Se tiver dúvidas, " : ""}fale com a nossa equipe pelo formulário de contato do Rolês.
        </p>
      </td></tr>
    `),
        attachments: [logoAttachment],
    });
    return true;
}

function erroHttp(status, mensagem) {
    const e = new Error(mensagem);
    e.status = status;
    return e;
}

// Mudança de status de um pedido. Transições permitidas:
//   pendente -> aprovado (confirmar pagamento) ou cancelado
//   aprovado -> cancelado ou reembolsado
//   cortesia -> cancelado
// Cancelar/reembolsar libera os ingressos (a trava de capacidade só conta aprovado e cortesia)
// e os assentos numerados. Tudo numa transação: ou muda tudo, ou não muda nada.
const TRANSICOES_PEDIDO = {
    pendente: ["aprovado", "cancelado"],
    aprovado: ["cancelado", "reembolsado"],
    cortesia: ["cancelado"],
};

// Reenvia por e-mail o ingresso de um pedido pago ou cortesia (ação de suporte)
router.post("/pedidos/:id/reenviar-ingresso", authAdmin, async (req, res) => {
    const id = req.params.id;
    if (!/^\d+$/.test(id)) return res.status(400).json({ erro: "Id inválido." });
    try {
        const rows = await consulta("SELECT status FROM pedidos WHERE id = ?", [id]);
        if (!rows[0]) return res.status(404).json({ erro: "Pedido não encontrado." });
        if (!["aprovado", "cortesia"].includes(rows[0].status)) {
            return res.status(409).json({ erro: "Só é possível reenviar o ingresso de pedidos pagos ou cortesia." });
        }
        const ok = await avisarPedido(id, "confirmado", "");
        if (!ok) return res.status(502).json({ erro: "Não foi possível enviar: o comprador não tem e-mail cadastrado." });
        res.json({ mensagem: "Ingresso reenviado.", email_enviado: true });
    } catch (e) {
        console.error("Erro ao reenviar ingresso:", e.message);
        res.status(502).json({ erro: "Não foi possível enviar o e-mail. Tente de novo em instantes." });
    }
});

router.put("/pedidos/:id/status", authAdmin, async (req, res) => {
    const id = req.params.id;
    if (!/^\d+$/.test(id)) return res.status(400).json({ erro: "Id inválido." });

    const novo = String(req.body.status || "");
    const motivo = String(req.body.motivo || "").trim();
    if (!["aprovado", "cancelado", "reembolsado"].includes(novo)) {
        return res.status(400).json({ erro: "Status inválido." });
    }
    if (novo !== "aprovado" && motivo.length < 10) {
        return res.status(400).json({ erro: "Informe o motivo (mínimo de 10 caracteres)." });
    }

    try {
        await connection.transacao(async (tx) => {
            const peds = await tx.query("SELECT id, status FROM pedidos WHERE id = ? FOR UPDATE", [id]);
            const ped = peds[0];
            if (!ped) throw erroHttp(404, "Pedido não encontrado.");
            if (!(TRANSICOES_PEDIDO[ped.status] || []).includes(novo)) {
                throw erroHttp(409, `Não é possível mudar um pedido "${ped.status}" para "${novo}".`);
            }

            const itens = await tx.query(
                `SELECT v.ingresso_id, v.quantidade, i.titulo, i.tipo_selecao, i.quantidade_total
                 FROM vendas v JOIN ingressos i ON i.id = v.ingresso_id
                 WHERE v.pedido_id = ?`,
                [id]
            );

            if (novo === "aprovado") {
                // Pedido pendente não reservava estoque: confere se ainda há ingressos
                for (const it of itens) {
                    if (it.tipo_selecao === "numerado") continue; // assentos já ficam presos desde a compra
                    const oc = await tx.query(
                        "SELECT COALESCE(SUM(quantidade), 0) AS total FROM vendas WHERE ingresso_id = ? AND status IN ('aprovado', 'cortesia')",
                        [it.ingresso_id]
                    );
                    const ocupados = Number(oc[0] && oc[0].total) || 0;
                    if (ocupados + Number(it.quantidade) > Number(it.quantidade_total)) {
                        throw erroHttp(409, `Não há mais ingressos suficientes de "${it.titulo}" para confirmar este pedido.`);
                    }
                }
            }

            await tx.query("UPDATE pedidos SET status = ?, atualizado_em = NOW() WHERE id = ?", [novo, id]);
            await tx.query("UPDATE vendas SET status = ? WHERE pedido_id = ?", [novo, id]);

            if (novo !== "aprovado" && itens.some((it) => it.tipo_selecao === "numerado")) {
                await tx.query("UPDATE assentos SET status = 'disponivel', pedido_id = NULL WHERE pedido_id = ?", [id]);
            }
        });
    } catch (e) {
        if (e.status) return res.status(e.status).json({ erro: e.message });
        console.error("Erro ao mudar status do pedido:", e.message);
        return res.status(500).json({ erro: "Erro ao atualizar o pedido." });
    }

    let emailEnviado = false;
    try {
        emailEnviado = await avisarPedido(id, novo === "aprovado" ? "confirmado" : novo, motivo);
    } catch (e) {
        console.error("Erro ao avisar o comprador:", e.message);
    }
    res.json({ mensagem: "Pedido atualizado.", status: novo, email_enviado: emailEnviado });
});

// ─────────────────────────────────────────────────────
// MENSAGENS DE CONTATO
// ─────────────────────────────────────────────────────

// Listar todas as mensagens (menos as arquivadas)
router.get("/mensagens", authAdmin, (req, res) => {
    connection.query(
        "SELECT * FROM contatos WHERE arquivado_em IS NULL ORDER BY criado_em DESC",
        [],
        (err, rows) => {
            if (err) return res.status(500).json({ erro: err.message });
            res.json(rows);
        }
    );
});

// Marcar como lido
router.put("/mensagens/:id/lido", authAdmin, (req, res) => {
    connection.query(
        "UPDATE contatos SET status = 'lido' WHERE id = ? AND status = 'novo'",
        [req.params.id],
        (err) => {
            if (err) return res.status(500).json({ erro: err.message });
            res.json({ mensagem: "Mensagem marcada como lida." });
        }
    );
});

// Responder mensagem: envia o e-mail primeiro e só então marca como respondida.
// Se o e-mail falhar, a mensagem continua pendente para tentar de novo.
router.post("/mensagens/:id/responder", authAdmin, (req, res) => {
    const resposta = String(req.body.resposta || "").trim();
    if (!resposta) {
        return res.status(400).json({ erro: "Resposta não pode ser vazia." });
    }

    connection.query(
        "SELECT * FROM contatos WHERE id = ?",
        [req.params.id],
        async (err, rows) => {
            if (err) return res.status(500).json({ erro: err.message });
            if (!rows.length) return res.status(404).json({ erro: "Mensagem não encontrada." });

            const contato = rows[0];

            try {
                await transporter.sendMail({
                    from: `"Rolês Suporte" <${process.env.EMAIL_USER}>`,
                    to: contato.email,
                    subject: `Re: [Protocolo #${contato.id}] ${String(contato.assunto || "").replace(/[\r\n]+/g, " ")}`,
                    html: wrapEmail(`
      <tr><td style="padding:40px;">
        <h2 style="color:#1a1a2e;margin:0 0 12px;font-size:22px;">Resposta ao seu contato</h2>
        <p style="color:#333;font-size:15px;margin:0 0 8px;">Olá, <strong>${escHtml(contato.nome)}</strong>!</p>
        <p style="color:#555;font-size:14px;margin:0 0 20px;line-height:1.6;">
          Respondemos à sua mensagem sobre <strong>${escHtml(contato.assunto)}</strong>:
        </p>
        <div style="background:#f5f0ff;border-left:4px solid #6c2bd9;border-radius:8px;padding:20px;margin-bottom:24px;font-size:14px;color:#333;line-height:1.7;">
          ${escHtml(resposta).replace(/\n/g, "<br>")}
        </div>
        <p style="color:#999;font-size:12px;margin:0;">Mensagem original:</p>
        <div style="background:#fafafa;border-left:3px solid #ddd;padding:12px 16px;margin-top:8px;font-size:13px;color:#999;line-height:1.6;">
          ${escHtml(contato.mensagem).replace(/\n/g, "<br>")}
        </div>
        <p style="color:#bbb;font-size:11px;margin-top:20px;">Protocolo #${escHtml(contato.id)}</p>
      </td></tr>
    `),
                    attachments: [logoAttachment],
                });
            } catch (mailErr) {
                console.error("Erro ao enviar e-mail de resposta:", mailErr.message);
                return res.status(500).json({ erro: "Não foi possível enviar o e-mail. A mensagem continua pendente." });
            }

            connection.query(
                "UPDATE contatos SET status = 'respondido', resposta = ?, respondido_em = NOW() WHERE id = ?",
                [resposta, req.params.id],
                (err2) => {
                    if (err2) {
                        console.error("Erro ao salvar resposta:", err2.message);
                        return res.status(500).json({ erro: "O e-mail foi enviado, mas falhou ao registrar a resposta no sistema." });
                    }
                    res.json({ mensagem: "Resposta enviada com sucesso!" });
                }
            );
        }
    );
});

// GET /admin/mensagens/:id/thread — busca conversa completa
router.get("/mensagens/:id/thread", authAdmin, (req, res) => {
    connection.query(
        `SELECT * FROM contato_respostas
         WHERE contato_id = ?
         ORDER BY criado_em ASC`,
        [req.params.id],
        (err, rows) => {
            if (err) return res.status(500).json({ erro: err.message });
            res.json(rows);
        }
    );
});

// ─────────────────────────────────────────────────────
// AVALIAÇÕES (esconde as arquivadas e as de locais arquivados)
// A nota do local é recalculada ao arquivar/restaurar (adminArquivo.js)
// ─────────────────────────────────────────────────────
router.get("/avaliacoes", authAdmin, (req, res) => {
    connection.query(
        `SELECT a.id, a.nota, a.comentario, a.nome_autor, a.created_at,
                e.nome AS estabelecimento_nome
         FROM avaliacoes a
         LEFT JOIN estabelecimentos e ON e.id = a.estabelecimento_id
         WHERE a.arquivado_em IS NULL AND (e.id IS NULL OR e.arquivado_em IS NULL)
         ORDER BY a.created_at DESC`,
        [],
        (err, rows) => {
            if (err) return res.status(500).json({ erro: err.message });
            res.json(rows);
        }
    );
});

// GET /admin/denuncias
router.get("/denuncias", authAdmin, async (req, res) => {
    try {
       const rows = await consulta(`
    SELECT d.id,
           d.tipo AS tipo_alvo,
           d.alvo_id,
           d.alvo_nome,
           d.motivo,
           d.descricao,
           d.status,
           d.observacao_admin AS resposta,
           d.analisado_em AS respondido_em,
           d.criado_em,
           u.nome_completo AS denunciante_nome,
           u.email AS denunciante_email,
           a.nome_completo AS analisado_por_nome
    FROM denuncias d
    LEFT JOIN usuarios u ON u.id = d.usuario_id
    LEFT JOIN usuarios a ON a.id = d.analisado_por
    ORDER BY d.criado_em DESC
`);
        res.json(rows);
    } catch (e) {
        console.error("Erro ao listar denúncias:", e.message);
        res.status(500).json({ erro: "Erro ao carregar denúncias." });
    }
});

// PUT /admin/denuncias/:id/status   body: { status, resposta }
// Avisa o denunciante por e-mail quando a denúncia é resolvida ou rejeitada.
// Devolve true se o e-mail saiu, false se não deu para enviar.
async function avisarDenunciante(id, status, resposta) {
    const rows = await consulta(
        `SELECT d.id, d.tipo, d.alvo_nome, u.nome_completo, u.email
         FROM denuncias d
         JOIN usuarios u ON u.id = d.usuario_id
         WHERE d.id = ?`,
        [id]
    );
    const d = rows[0];
    if (!d || !d.email) return false;

    const rotulo = d.tipo === "evento" ? "evento" : "local";
    const resolvida = status === "resolvida";
    await transporter.sendMail({
        from: `"Rolês Suporte" <${process.env.EMAIL_USER}>`,
        to: d.email,
        subject: `[Denúncia #${d.id}] ${resolvida ? "Analisamos a sua denúncia" : "Sobre a sua denúncia"}`,
        html: wrapEmail(`
      <tr><td style="padding:40px;">
        <h2 style="color:#1a1a2e;margin:0 0 12px;font-size:22px;">Retorno sobre a sua denúncia</h2>
        <p style="color:#333;font-size:15px;margin:0 0 8px;">Olá, <strong>${escHtml(d.nome_completo || "")}</strong>!</p>
        <p style="color:#555;font-size:14px;margin:0 0 20px;line-height:1.6;">
          Analisamos a sua denúncia sobre o ${rotulo} <strong>${escHtml(d.alvo_nome)}</strong>
          e ${resolvida ? "tomamos as providências cabíveis" : "não identificamos irregularidade neste caso"}.
        </p>
        <p style="color:#999;font-size:12px;margin:0 0 8px;">Resposta da nossa equipe:</p>
        <div style="background:#f5f0ff;border-left:4px solid #6c2bd9;border-radius:8px;padding:20px;margin-bottom:24px;font-size:14px;color:#333;line-height:1.7;">
          ${escHtml(resposta).replace(/\n/g, "<br>")}
        </div>
        <p style="color:#bbb;font-size:11px;margin:0;">Protocolo #${escHtml(d.id)}. Obrigado por ajudar a manter o Rolês confiável.</p>
      </td></tr>
    `),
        attachments: [logoAttachment],
    });
    return true;
}

// PUT /admin/denuncias/:id/status   body: { status, resposta }
router.put("/denuncias/:id/status", authAdmin, async (req, res) => {
    try {
        if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ erro: "Id inválido." });
        const { status } = req.body;
        const resposta = String(req.body.resposta || "").trim().slice(0, 1000);
        if (!["pendente", "em_analise", "resolvida", "rejeitada"].includes(status)) {
            return res.status(400).json({ erro: "Status inválido." });
        }
        const fechada = status === "resolvida" || status === "rejeitada";
        if (fechada && resposta.length < 5) {
            return res.status(400).json({ erro: "Escreva uma resposta (mínimo de 5 caracteres)." });
        }

        const antes = await consulta("SELECT status FROM denuncias WHERE id = ?", [req.params.id]);
        if (!antes[0]) return res.status(404).json({ erro: "Denúncia não encontrada." });

        await consulta(
            `UPDATE denuncias
                SET status = ?,
                    observacao_admin = ?,
                    analisado_por = ?,
                    analisado_em = ${fechada ? "NOW()" : "NULL"}
              WHERE id = ?`,
            [status, fechada ? resposta : null, req._eu ? req._eu.id : null, req.params.id]
        );

        if (req._eu) {
            consulta("INSERT INTO admin_log (usuario_id, acao) VALUES (?, ?)", [
                req._eu.id, `Denúncia #${req.params.id}: status ${status}`,
            ]).catch(() => {});
        }

        // Só avisa quando a denúncia acabou de ser fechada (não reenvia se já estava fechada com o mesmo status)
        let emailEnviado = null;
        if (fechada && antes[0].status !== status) {
            try {
                emailEnviado = await avisarDenunciante(req.params.id, status, resposta);
            } catch (e) {
                console.error("Erro ao avisar o denunciante:", e.message);
                emailEnviado = false;
            }
        }

        res.json({ ok: true, email_enviado: emailEnviado });
    } catch (e) {
        console.error("Erro ao atualizar denúncia:", e.message);
        res.status(500).json({ erro: "Erro ao atualizar a denúncia: " + e.message });
    }
});

module.exports = router;