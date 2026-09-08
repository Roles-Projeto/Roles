// =====================================================
//  backend/routes/admin.js
//  Versão completa com seção de MENSAGENS adicionada
// =====================================================

const express = require("express");
const router = express.Router();
const authAdmin = require("../middleware/authAdmin");
const connection = require("../db/db_config");
const nodemailer = require("nodemailer");
const { wrapEmail, logoAttachment } = require("../services/emailTemplate");

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

// ─────────────────────────────────────────────────────
// 📊 DASHBOARD
// ─────────────────────────────────────────────────────
router.get("/dashboard", authAdmin, (req, res) => {
    const queries = {
        usuarios: "SELECT COUNT(*) as total FROM usuarios",
        estabelecimentos: "SELECT COUNT(*) as total FROM estabelecimentos",
        eventos: "SELECT COUNT(*) as total FROM eventos",
        avaliacoes: "SELECT COUNT(*) as total FROM avaliacoes",
        ingressos: "SELECT COUNT(*) as total FROM ingressos",
        mensagens: "SELECT COUNT(*) as total FROM contatos WHERE status = 'novo'",
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
// 👥 USUÁRIOS
// ─────────────────────────────────────────────────────
router.get("/usuarios", authAdmin, (req, res) => {
    connection.query(
        "SELECT id, nome_completo, email, telefone, role, verificado, criado_em FROM usuarios ORDER BY criado_em DESC",
        [],
        (err, rows) => {
            if (err) return res.status(500).json({ erro: err.message });
            res.json(rows);
        }
    );
});

router.put("/usuarios/:id", authAdmin, (req, res) => {
    const { nome_completo, email, role, verificado } = req.body;
    connection.query(
        "UPDATE usuarios SET nome_completo = ?, email = ?, role = ?, verificado = ? WHERE id = ?",
        [nome_completo, email, role, verificado, req.params.id],
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

router.delete("/usuarios/:id", authAdmin, (req, res) => {
    connection.query(
        "DELETE FROM usuarios WHERE id = ?",
        [req.params.id],
        (err) => {
            if (err) return res.status(500).json({ erro: err.message });
            res.json({ mensagem: "Usuário deletado com sucesso." });
        }
    );
});

// ─────────────────────────────────────────────────────
// 🏪 ESTABELECIMENTOS
// ─────────────────────────────────────────────────────
router.get("/estabelecimentos", authAdmin, (req, res) => {
    connection.query(
        "SELECT id, nome, tipo, cidade, estado, avaliacoes, nota, visibilidade, criado_em FROM estabelecimentos ORDER BY criado_em DESC",
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

router.delete("/estabelecimentos/:id", authAdmin, (req, res) => {
    connection.query(
        "DELETE FROM estabelecimentos WHERE id = ?",
        [req.params.id],
        (err) => {
            if (err) return res.status(500).json({ erro: err.message });
            res.json({ mensagem: "Estabelecimento deletado com sucesso." });
        }
    );
});

// ─────────────────────────────────────────────────────
// 📅 EVENTOS
// ─────────────────────────────────────────────────────
router.get("/eventos", authAdmin, (req, res) => {
    connection.query(
        "SELECT * FROM eventos ORDER BY criado_em DESC",
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

router.delete("/eventos/:id", authAdmin, (req, res) => {
    connection.query(
        "DELETE FROM eventos WHERE id = ?",
        [req.params.id],
        (err) => {
            if (err) return res.status(500).json({ erro: err.message });
            res.json({ mensagem: "Evento deletado com sucesso." });
        }
    );
});

// ─────────────────────────────────────────────────────
// 🎟 INGRESSOS
// ─────────────────────────────────────────────────────
router.get("/ingressos", authAdmin, (req, res) => {
    connection.query(
        `SELECT i.id, i.titulo, i.tipo, i.valor, i.quantidade_total, i.evento_id,
                e.nome AS evento_nome
         FROM ingressos i
         LEFT JOIN eventos e ON e.id = i.evento_id
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

router.delete("/ingressos/:id", authAdmin, (req, res) => {
    connection.query(
        "DELETE FROM ingressos WHERE id = ?",
        [req.params.id],
        (err) => {
            if (err) return res.status(500).json({ erro: err.message });
            res.json({ mensagem: "Ingresso deletado com sucesso." });
        }
    );
});

// ─────────────────────────────────────────────────────
// 🛒 PEDIDOS
// ─────────────────────────────────────────────────────

// Listar pedidos
router.get("/pedidos", authAdmin, (req, res) => {
    connection.query(
        `SELECT p.*, u.nome_completo, e.nome AS evento_nome
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

// Excluir pedido
router.delete("/pedidos/:id", authAdmin, (req, res) => {
    connection.query(
        "DELETE FROM pedidos WHERE id = ?",
        [req.params.id],
        (err) => {
            if (err) return res.status(500).json({ erro: err.message });
            res.json({ mensagem: "Pedido excluído com sucesso." });
        }
    );
});

// ─────────────────────────────────────────────────────
// ✉️  MENSAGENS DE CONTATO  ← NOVO
// ─────────────────────────────────────────────────────

// Listar todas as mensagens
router.get("/mensagens", authAdmin, (req, res) => {
    connection.query(
        "SELECT * FROM contatos ORDER BY criado_em DESC",
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

// Responder mensagem — salva no banco e envia e-mail ao remetente
router.post("/mensagens/:id/responder", authAdmin, async (req, res) => {
    const { resposta } = req.body;
    if (!resposta || !resposta.trim()) {
        return res.status(400).json({ erro: "Resposta não pode ser vazia." });
    }

    // Busca a mensagem original
    connection.query(
        "SELECT * FROM contatos WHERE id = ?",
        [req.params.id],
        async (err, rows) => {
            if (err) return res.status(500).json({ erro: err.message });
            if (!rows.length) return res.status(404).json({ erro: "Mensagem não encontrada." });

            const contato = rows[0];

            // Salva resposta no banco
            connection.query(
                "UPDATE contatos SET status = 'respondido', resposta = ?, respondido_em = NOW() WHERE id = ?",
                [resposta.trim(), req.params.id],
                async (err2) => {
                    if (err2) return res.status(500).json({ erro: err2.message });

                    // Envia e-mail de resposta ao usuário
                    try {
                        await transporter.sendMail({
                            from: `"Rolês Suporte" <${process.env.EMAIL_USER}>`,
                            to: contato.email,
                            subject: `Re: [Protocolo #${req.params.id}] ${contato.assunto}`,
                            html: wrapEmail(`
      <tr><td style="padding:40px;">
        <h2 style="color:#1a1a2e;margin:0 0 12px;font-size:22px;">Resposta ao seu contato</h2>
        <p style="color:#333;font-size:15px;margin:0 0 8px;">Olá, <strong>${contato.nome}</strong>!</p>
        <p style="color:#555;font-size:14px;margin:0 0 20px;line-height:1.6;">
          Respondemos à sua mensagem sobre <strong>${contato.assunto}</strong>:
        </p>
        <div style="background:#f5f0ff;border-left:4px solid #6c2bd9;border-radius:8px;padding:20px;margin-bottom:24px;font-size:14px;color:#333;line-height:1.7;">
          ${resposta.trim().replace(/\n/g, "<br>")}
        </div>
        <p style="color:#999;font-size:12px;margin:0;">Mensagem original:</p>
        <div style="background:#fafafa;border-left:3px solid #ddd;padding:12px 16px;margin-top:8px;font-size:13px;color:#999;line-height:1.6;">
          ${contato.mensagem.replace(/\n/g, "<br>")}
        </div>
        <p style="color:#bbb;font-size:11px;margin-top:20px;">Protocolo #${contato.id}</p>
      </td></tr>
    `),
                            attachments: [logoAttachment]
                        });
                        res.json({ mensagem: "Resposta enviada com sucesso!" });
                    } catch (mailErr) {
                        console.error("Erro ao enviar e-mail de resposta:", mailErr.message);
                        res.status(500).json({ erro: "Resposta salva, mas falha ao enviar e-mail: " + mailErr.message });
                    }
                }
            );
        }
    );
});

// Deletar mensagem
router.delete("/mensagens/:id", authAdmin, (req, res) => {
    connection.query(
        "DELETE FROM contatos WHERE id = ?",
        [req.params.id],
        (err) => {
            if (err) return res.status(500).json({ erro: err.message });
            res.json({ mensagem: "Mensagem deletada com sucesso." });
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
// ⭐ AVALIAÇÕES
// ─────────────────────────────────────────────────────
router.get("/avaliacoes", authAdmin, (req, res) => {
    connection.query(
        `SELECT a.id, a.nota, a.comentario, a.nome_autor, a.created_at,
                e.nome AS estabelecimento_nome
         FROM avaliacoes a
         LEFT JOIN estabelecimentos e ON e.id = a.estabelecimento_id
         ORDER BY a.created_at DESC`,
        [],
        (err, rows) => {
            if (err) return res.status(500).json({ erro: err.message });
            res.json(rows);
        }
    );
});

router.delete("/avaliacoes/:id", authAdmin, (req, res) => {
    connection.query(
        "SELECT estabelecimento_id FROM avaliacoes WHERE id = ?",
        [req.params.id],
        (err, rows) => {
            if (err) return res.status(500).json({ erro: err.message });
            if (!rows.length) return res.status(404).json({ erro: "Avaliação não encontrada." });

            const estId = rows[0].estabelecimento_id;

            connection.query("DELETE FROM avaliacoes WHERE id = ?", [req.params.id], (err2) => {
                if (err2) return res.status(500).json({ erro: err2.message });

                // Recalcula média do estabelecimento
                connection.query(
                    "SELECT COUNT(*) AS total, AVG(nota) AS media FROM avaliacoes WHERE estabelecimento_id = ?",
                    [estId],
                    (err3, r) => {
                        if (!err3 && r[0]) {
                            connection.query(
                                "UPDATE estabelecimentos SET nota = ?, avaliacoes = ? WHERE id = ?",
                                [parseFloat(r[0].media || 0).toFixed(1), r[0].total, estId],
                                () => { }
                            );
                        }
                        res.json({ mensagem: "Avaliação deletada com sucesso." });
                    }
                );
            });
        }
    );
});

router.get("/pedidos", authAdmin, (req, res) => {
    connection.query(
        `SELECT p.*, u.nome_completo, e.nome AS evento_nome
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

router.delete("/pedidos/:id", authAdmin, (req, res) => {
    connection.query(
        "DELETE FROM pedidos WHERE id = ?",
        [req.params.id],
        (err) => {
            if (err) return res.status(500).json({ erro: err.message });
            res.json({ mensagem: "Pedido excluído com sucesso." });
        }
    );
});

router.delete("/pedidos", authAdmin, (req, res) => {
    connection.query(
        "DELETE FROM pedidos",
        [],
        (err) => {
            if (err) return res.status(500).json({ erro: err.message });
            res.json({ mensagem: "Todos os pedidos foram removidos." });
        }
    );
});
module.exports = router;