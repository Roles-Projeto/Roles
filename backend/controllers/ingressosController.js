"use strict";

const db     = require("../db/db_config");
const crypto = require("crypto");

// ====================================================
// LISTAR EVENTOS DISPONÍVEIS
// ====================================================
async function listarEventos(req, res) {
    try {
        const eventos = await db.query(`
            SELECT e.*,
                   MIN(i.valor) AS preco_minimo,
                   COUNT(i.id)  AS tipos_disponiveis
            FROM eventos e
            LEFT JOIN ingressos i ON i.evento_id = e.id
            WHERE e.data_inicio > NOW()
            GROUP BY e.id
            ORDER BY e.data_inicio ASC
        `);
        res.json(eventos);
    } catch (err) {
        console.error("Erro ao listar eventos:", err);
        res.status(500).json({ erro: "Erro ao listar eventos.", detalhe: err.message });
    }
}

// ====================================================
// DETALHE DO EVENTO + TIPOS DE INGRESSO
// ====================================================
async function detalheEvento(req, res) {
    const { id } = req.params;
    try {
        const rows = await db.query("SELECT * FROM eventos WHERE id = ?", [id]);
        const evento = rows[0];
        if (!evento) return res.status(404).json({ erro: "Evento não encontrado." });

        const tipos = await db.query(`
            SELECT id, titulo AS nome, tipo, valor AS preco,
                   quantidade_total, quantidade_total AS disponivel
            FROM ingressos
            WHERE evento_id = ?
        `, [id]);

        res.json({ ...evento, tipos_ingresso: tipos });
    } catch (err) {
        console.error("Erro ao buscar evento:", err);
        res.status(500).json({ erro: "Erro interno.", detalhe: err.message });
    }
}

// ====================================================
// COMPRAR INGRESSO
// ====================================================
async function comprarIngresso(req, res) {
    const { usuario_id, evento_id, itens, forma_pagamento } = req.body;

    if (!usuario_id || !evento_id || !itens?.length || !forma_pagamento) {
        return res.status(400).json({ erro: "Dados incompletos." });
    }

    const formasValidas = ["credito", "debito", "boleto", "pix"];
    if (!formasValidas.includes(forma_pagamento)) {
        return res.status(400).json({ erro: "Forma de pagamento inválida." });
    }

    try {
        let valor_total = 0;
        const detalhes  = [];

        for (const item of itens) {
            const rows = await db.query(
                "SELECT * FROM ingressos WHERE id = ? AND evento_id = ?",
                [item.tipo_ingresso_id, evento_id]
            );
            const tipo = rows[0];
            if (!tipo) {
                return res.status(400).json({ erro: `Ingresso ${item.tipo_ingresso_id} inválido.` });
            }
            valor_total += parseFloat(tipo.valor) * item.quantidade;
            detalhes.push({ tipo, quantidade: item.quantidade });
        }

        const status_pagamento = simularPagamento(forma_pagamento);

        const pedidoResult = await db.query(
            "INSERT INTO pedidos (usuario_id, evento_id, valor_total, forma_pagamento, status) VALUES (?, ?, ?, ?, ?)",
            [usuario_id, evento_id, valor_total, forma_pagamento, status_pagamento]
        );
        const pedido_id = pedidoResult.insertId ?? pedidoResult[0]?.id;

        const ingressosGerados = detalhes.flatMap(d =>
            Array.from({ length: d.quantidade }, () => ({
                tipo:      d.tipo.titulo,
                codigo_qr: gerarCodigoQR(pedido_id, d.tipo.id, usuario_id),
            }))
        );

        if (status_pagamento === "aprovado") {
            try {
                const { enviarEmailIngresso } = require("../services/emailService");
                const [usuarioRows, eventoRows] = await Promise.all([
                    db.query("SELECT nome_completo, email FROM usuarios WHERE id = ?", [usuario_id]),
                    db.query("SELECT nome, data_inicio, local_nome, cidade FROM eventos WHERE id = ?", [evento_id]),
                ]);
                const usuario = usuarioRows[0];
                const evento  = eventoRows[0];
                if (usuario && evento) {
                    const d = new Date(evento.data_inicio);
                    enviarEmailIngresso({
                        nomeCliente:     usuario.nome_completo,
                        emailCliente:    usuario.email,
                        pedido_id,
                        nomeEvento:      evento.nome,
                        dataEvento:      d.toLocaleDateString("pt-BR"),
                        horaEvento:      d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
                        localEvento:     `${evento.local_nome}, ${evento.cidade}`,
                        nomeIngresso:    detalhes[0]?.tipo?.titulo || "Ingresso",
                        quantidade:      ingressosGerados.length,
                        subtotal:        valor_total,
                        taxaServico:     valor_total * 0.10,
                        totalPago:       valor_total * 1.10,
                        forma_pagamento,
                        ingressos:       ingressosGerados,
                    }).catch(e => console.error("❌ Erro ao enviar e-mail:", e.message));
                }
            } catch (e) {
                console.error("❌ Erro ao buscar dados para e-mail:", e.message);
            }
        }

        res.status(201).json({
            mensagem: status_pagamento === "aprovado"
                ? "Compra realizada com sucesso!"
                : "Pagamento pendente. Aguardando confirmação.",
            pedido_id,
            status:         status_pagamento,
            valor_total,
            forma_pagamento,
            ingressos:      ingressosGerados,
        });

    } catch (err) {
        console.error("Erro ao comprar ingresso:", err);
        res.status(500).json({ erro: "Erro interno ao processar compra.", detalhe: err.message });
    }
}

// ====================================================
// MEUS INGRESSOS
// ====================================================
async function meusIngressos(req, res) {
    const { usuario_id } = req.params;
    if (!usuario_id) {
        return res.status(400).json({ erro: "usuario_id não informado." });
    }

    try {
        const ingressos = await db.query(`
            SELECT
                p.id,
                p.usuario_id,
                p.evento_id,
                p.valor_total                                           AS preco,
                p.forma_pagamento,
                p.status                                                AS status_pagamento,
                p.criado_em,
                e.nome                                                  AS nome_evento,
                e.data_inicio                                           AS data_evento,
                e.local_nome                                            AS local_evento,
                e.cidade,
                e.estado,
                e.imagem                                                AS img_capa,
                (SELECT titulo FROM ingressos WHERE evento_id = p.evento_id LIMIT 1) AS tipo_ingresso,
                (SELECT valor  FROM ingressos WHERE evento_id = p.evento_id LIMIT 1) AS preco_unitario
            FROM pedidos p
            JOIN eventos e ON e.id = p.evento_id
            WHERE p.usuario_id = ?
            ORDER BY p.criado_em DESC
        `, [usuario_id]);

        console.log(`✅ meusIngressos: ${ingressos.length} pedido(s) para usuario_id=${usuario_id}`);
        res.json(ingressos);

    } catch (err) {
        console.error("❌ ERRO meusIngressos:", err);
        res.status(500).json({ erro: "Erro ao buscar ingressos.", detalhe: err.message });
    }
}

// ====================================================
// VALIDAR QR CODE
// ====================================================
async function validarQRCode(req, res) {
    res.json({ valido: false, mensagem: "Validação por QR não configurada." });
}

// ====================================================
// DETALHE DO INGRESSO
// ====================================================
async function detalheIngresso(req, res) {
    const { id }         = req.params;
    const { usuario_id } = req.query;

    try {
        const rows = await db.query(`
            SELECT
                p.id,
                p.usuario_id,
                p.evento_id,
                p.valor_total        AS preco,
                p.forma_pagamento,
                p.status             AS status_pagamento,
                p.criado_em,
                e.nome               AS nome_evento,
                e.data_inicio        AS data_evento,
                e.local_nome         AS local_evento,
                e.cidade,
                e.estado,
                e.imagem             AS img_capa,
                i.titulo             AS tipo_ingresso,
                i.valor              AS preco_unitario
            FROM pedidos p
            JOIN eventos    e ON e.id = p.evento_id
            LEFT JOIN ingressos i ON i.evento_id = p.evento_id
            WHERE p.id = ? AND p.usuario_id = ?
            LIMIT 1
        `, [id, usuario_id]);

        const ingresso = rows[0];
        if (!ingresso) return res.status(404).json({ erro: "Ingresso não encontrado." });
        res.json(ingresso);

    } catch (err) {
        console.error("Erro ao buscar ingresso:", err);
        res.status(500).json({ erro: "Erro interno.", detalhe: err.message });
    }
}

// ====================================================
// AUXILIARES
// ====================================================
function gerarCodigoQR(pedido_id, tipo_id, usuario_id) {
    const dados = `${pedido_id}-${tipo_id}-${usuario_id}-${Date.now()}-${Math.random()}`;
    return crypto.createHash("sha256").update(dados).digest("hex");
}

function simularPagamento(forma_pagamento) {
    if (forma_pagamento === "boleto") return "pendente";
    return "aprovado";
}

// ====================================================
// REENVIAR E-MAIL DO INGRESSO
// POST /pedidos/:id/reenviar-email
// ====================================================
async function reenviarEmailIngresso(req, res) {
    const { id } = req.params;

    try {
        const rows = await db.query(`
            SELECT
                p.id            AS pedido_id,
                p.usuario_id,
                p.valor_total,
                p.forma_pagamento,
                p.status,
                e.nome          AS nome_evento,
                e.data_inicio,
                e.local_nome,
                e.cidade,
                u.nome_completo,
                u.email,
                (SELECT titulo FROM ingressos WHERE evento_id = p.evento_id LIMIT 1) AS tipo_ingresso
            FROM pedidos p
            JOIN eventos  e ON e.id = p.evento_id
            JOIN usuarios u ON u.id = p.usuario_id
            WHERE p.id = ?
            LIMIT 1
        `, [id]);

        const d = rows[0];
        if (!d) return res.status(404).json({ erro: "Pedido não encontrado." });
        if (!d.email) return res.status(400).json({ erro: "Usuário sem e-mail cadastrado." });

        const dataEvt    = new Date(d.data_inicio);
        const codigo_qr  = `ROLES-PEDIDO-${d.pedido_id}-USUARIO-${d.usuario_id}`;

        const { enviarEmailIngresso } = require("../services/emailService");

        await enviarEmailIngresso({
            nomeCliente:     d.nome_completo,
            emailCliente:    d.email,
            pedido_id:       d.pedido_id,
            nomeEvento:      d.nome_evento,
            dataEvento:      dataEvt.toLocaleDateString("pt-BR"),
            horaEvento:      dataEvt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
            localEvento:     `${d.local_nome}, ${d.cidade}`,
            nomeIngresso:    d.tipo_ingresso || "Ingresso",
            quantidade:      1,
            subtotal:        d.valor_total,
            taxaServico:     d.valor_total * 0.10,
            totalPago:       d.valor_total * 1.10,
            forma_pagamento: d.forma_pagamento,
            ingressos:       [{ tipo: d.tipo_ingresso || "Ingresso", codigo_qr }],
        });

        res.json({ mensagem: "E-mail reenviado com sucesso." });

    } catch (err) {
        console.error("❌ Erro ao reenviar e-mail:", err);
        res.status(500).json({ erro: "Erro ao reenviar e-mail.", detalhe: err.message });
    }
}
module.exports = {
    listarEventos,
    detalheEvento,
    comprarIngresso,
    meusIngressos,
    validarQRCode,
    detalheIngresso,
    reenviarEmailIngresso,   // ← novo
};