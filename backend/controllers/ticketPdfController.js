"use strict";

const PDFDocument = require("pdfkit");
const QRCode      = require("qrcode");
const db          = require("../db/db_config");

function mascaraCPF(cpf) {
    if (!cpf) return "Não informado";
    const d = cpf.replace(/\D/g, "");
    if (d.length !== 11) return cpf;
    return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}

function formatarData(dateStr) {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleDateString("pt-BR", {
        day: "2-digit", month: "long", year: "numeric"
    });
}

function formatarBRL(valor) {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency", currency: "BRL"
    }).format(valor);
}

function labelPagamento(forma) {
    const mapa = {
        credito: "Cartão de crédito",
        debito:  "Cartão de débito",
        boleto:  "Boleto bancário",
        pix:     "Pix",
    };
    return mapa[forma] || forma || "—";
}

// ====================================================
// GERAR PDF DO INGRESSO
// GET /ingressos/:id/download?usuario_id=5
// ====================================================
async function downloadIngressoPDF(req, res) {
    const { id }         = req.params;
    const { usuario_id } = req.query;

    try {
        const rows = await db.query(`
            SELECT
                p.id            AS pedido_id,
                p.valor_total,
                p.forma_pagamento,
                p.status,
                p.criado_em,
                e.nome          AS nome_evento,
                e.data_inicio,
                e.local_nome,
                e.cidade,
                e.estado,
                u.nome_completo,
                u.cpf,
                u.email,
                (SELECT titulo FROM ingressos WHERE evento_id = p.evento_id LIMIT 1) AS tipo_ingresso
            FROM pedidos p
            JOIN eventos  e ON e.id = p.evento_id
            JOIN usuarios u ON u.id = p.usuario_id
            WHERE p.id = ? AND p.usuario_id = ?
            LIMIT 1
        `, [id, usuario_id]);

        const d = rows[0];
        if (!d) return res.status(404).json({ erro: "Ingresso não encontrado." });

        const qrData   = `ROLES-PEDIDO-${d.pedido_id}-USUARIO-${usuario_id}`;
        const qrBuffer = await QRCode.toBuffer(qrData, {
            errorCorrectionLevel: "M",
            width: 130,
            margin: 1,
            color: { dark: "#6c3dff", light: "#ffffff" },
        });

        const doc = new PDFDocument({ size: "A4", margin: 0 });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="ingresso-${d.pedido_id}.pdf"`
        );
        doc.pipe(res);

        const W       = 595.28;
        const PX      = 48;
        const ROXO    = "#6c3dff";
        const ROXO_CL = "#f3efff";
        const CINZA   = "#888780";
        const PRETO   = "#1a1a2e";

        doc.rect(0, 0, W, 90).fill(ROXO);
        doc.font("Helvetica-Bold").fontSize(28).fillColor("#ffffff").text("Rolês", PX, 22);
        doc.font("Helvetica").fontSize(12).fillColor("rgba(255,255,255,0.8)").text("Seu ingresso oficial", PX, 56);

        let y = 110;

        doc.font("Helvetica").fontSize(9).fillColor(CINZA).text("EVENTO", PX, y);
        y += 14;
        doc.font("Helvetica-Bold").fontSize(18).fillColor(PRETO).text(d.nome_evento, PX, y, { width: W - PX * 2 });
        y = doc.y + 6;
        doc.font("Helvetica").fontSize(11).fillColor(CINZA).text(
            `${formatarData(d.data_inicio)}   ·   ${d.local_nome || ""}${d.cidade ? ", " + d.cidade : ""}`,
            PX, y
        );
        y = doc.y + 16;

        doc.save().dash(4, { space: 4 }).moveTo(PX, y).lineTo(W - PX, y).stroke("#cccccc").restore();
        y += 16;

        const COL1  = PX;
        const COL2  = W / 2;
        const campos = [
            ["TITULAR",          d.nome_completo || "—"],
            ["CPF",              mascaraCPF(d.cpf)],
            ["TIPO DE INGRESSO", d.tipo_ingresso || "Ingresso"],
            ["PAGAMENTO",        labelPagamento(d.forma_pagamento)],
            ["VALOR PAGO",       formatarBRL(d.valor_total)],
            ["PEDIDO Nº",        `#${String(d.pedido_id).padStart(5, "0")}`],
        ];

        campos.forEach(([label, valor], i) => {
            const col = i % 2 === 0 ? COL1 : COL2;
            const row = Math.floor(i / 2);
            const ry  = y + row * 48;
            doc.font("Helvetica").fontSize(9).fillColor(CINZA).text(label, col, ry);
            doc.font("Helvetica-Bold").fontSize(13)
               .fillColor(label === "VALOR PAGO" ? ROXO : PRETO)
               .text(valor, col, ry + 13, { width: W / 2 - PX });
        });

        y += Math.ceil(campos.length / 2) * 48 + 8;

        doc.save().dash(4, { space: 4 }).moveTo(PX, y).lineTo(W - PX, y).stroke("#cccccc").restore();
        y += 20;

        const QR_SIZE = 110;
        doc.image(qrBuffer, PX, y, { width: QR_SIZE, height: QR_SIZE });
        doc.font("Helvetica-Bold").fontSize(13).fillColor(PRETO)
           .text("Apresente este QR Code na entrada", PX + QR_SIZE + 20, y + 6, {
               width: W - PX * 2 - QR_SIZE - 20,
           });
        doc.font("Helvetica").fontSize(11).fillColor(CINZA)
           .text(
               "Tenha o ingresso em mãos no dia do evento. Cada código é único e intransferível.",
               PX + QR_SIZE + 20, doc.y + 4,
               { width: W - PX * 2 - QR_SIZE - 20 }
           );

        y = Math.max(doc.y, y + QR_SIZE) + 20;

        doc.save().dash(4, { space: 4 }).moveTo(PX, y).lineTo(W - PX, y).stroke("#cccccc").restore();
        y += 16;

        const BANNER_H = 72;
        doc.rect(PX, y, W - PX * 2, BANNER_H).fill(ROXO_CL);
        doc.font("Helvetica-Bold").fontSize(13).fillColor("#3c2299").text("Baixe o app Rolês", PX + 16, y + 14);
        doc.font("Helvetica").fontSize(11).fillColor("#534ab7")
           .text(
               "Acesse seus ingressos, receba notificações e aproveite ainda mais. Disponível para iOS e Android.",
               PX + 16, doc.y + 4,
               { width: W - PX * 2 - 32 }
           );

        y += BANNER_H + 20;

        const hoje = new Date().toLocaleDateString("pt-BR");
        doc.font("Helvetica").fontSize(9).fillColor(CINZA)
           .text(`Rolês · roles.com.br · Documento gerado em ${hoje}`, 0, y, { align: "center", width: W });

        doc.end();

    } catch (err) {
        console.error("❌ downloadIngressoPDF:", err);
        if (!res.headersSent) {
            res.status(500).json({ erro: "Erro ao gerar PDF.", detalhe: err.message });
        }
    }
}

module.exports = { downloadIngressoPDF };