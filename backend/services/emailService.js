"use strict";

const nodemailer  = require("nodemailer");
const QRCode      = require("qrcode");
const PDFDocument = require("pdfkit");

// ─────────────────────────────────────────────────────────
//  Configure no seu .env:
//  EMAIL_USER=seuemail@gmail.com
//  EMAIL_PASS=xxxx xxxx xxxx xxxx  ← senha de app do Google
// ─────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
    service: "gmail",
    family: 4,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

function formatBRL(value) {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
    }).format(value);
}

/**
 * Envia e-mail de confirmação de compra com QR Code(s) embutidos e PDF anexado.
 *
 * @param {Object} dados
 * @param {string} dados.nomeCliente
 * @param {string} dados.emailCliente
 * @param {number} dados.pedido_id
 * @param {string} dados.nomeEvento
 * @param {string} dados.dataEvento        — ex: "02/02/2025"
 * @param {string} dados.horaEvento        — ex: "21:00"
 * @param {string} dados.localEvento
 * @param {string} dados.nomeIngresso
 * @param {number} dados.quantidade
 * @param {number} dados.subtotal
 * @param {number} dados.taxaServico
 * @param {number} dados.totalPago
 * @param {string} dados.forma_pagamento   — "credito" | "pix" | "boleto"
 * @param {Array}  dados.ingressos         — [{ tipo, codigo_qr }]
 */
async function enviarEmailIngresso(dados) {
    const {
        nomeCliente,
        emailCliente,
        pedido_id,
        nomeEvento,
        dataEvento,
        horaEvento,
        localEvento,
        nomeIngresso,
        quantidade,
        subtotal,
        taxaServico,
        totalPago,
        forma_pagamento,
        ingressos = [],
    } = dados;

    const formaPagamentoLabel = {
        credito: "Cartão de Crédito",
        pix:     "PIX",
        boleto:  "Boleto Bancário",
    }[forma_pagamento] || forma_pagamento;

    // ── Gera QR Code em base64 para cada ingresso ──────────
    const ingressosHtml = await Promise.all(
        ingressos.map(async (ing, i) => {
            const qrDataUrl = await QRCode.toDataURL(ing.codigo_qr, {
                width:  220,
                margin: 2,
                color: { dark: "#1a1a2e", light: "#ffffff" },
            });

            return `
            <div style="
                background:#f9f6ff;
                border:1px solid #d9c8f5;
                border-radius:12px;
                padding:24px;
                margin-bottom:16px;
                text-align:center;
            ">
                <p style="font-size:13px;color:#888;margin:0 0 4px;">
                    Ingresso ${i + 1} de ${ingressos.length}
                </p>
                <p style="font-size:16px;font-weight:700;color:#1a1a2e;margin:0 0 16px;">
                    ${ing.tipo || nomeIngresso}
                </p>
                <img src="${qrDataUrl}"
                     alt="QR Code do Ingresso"
                     style="width:180px;height:180px;border-radius:8px;border:4px solid #6c2bd9;" />
                <p style="font-size:11px;color:#999;margin:12px 0 0;word-break:break-all;">
                    Código: <strong>${ing.codigo_qr}</strong>
                </p>
            </div>`;
        })
    );

    // ── HTML do e-mail ──────────────────────────────────────
    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f0edf8;font-family:'Segoe UI',Arial,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;background:#f0edf8;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0"
       style="background:#fff;border-radius:16px;overflow:hidden;
              box-shadow:0 4px 24px rgba(108,43,217,.12);max-width:600px;">

  <!-- HEADER -->
  <tr>
    <td bgcolor="#6c2bd9" style="background-color:#6c2bd9;
               background-image:linear-gradient(135deg,#6c2bd9 0%,#9b59b6 100%);
               padding:40px;text-align:center;">
      <h1 style="color:#ffffff;margin:0;font-size:30px;letter-spacing:1px;">Rolês</h1>
      <p style="color:#f0e6ff;margin:8px 0 0;font-size:16px;">
        Ingresso confirmado com sucesso!
      </p>
    </td>
  </tr>

  <!-- SAUDAÇÃO -->
  <tr>
    <td style="padding:32px 40px 0;">
      <p style="font-size:16px;color:#333;margin:0;">
        Olá, <strong>${nomeCliente}</strong>!
      </p>
      <p style="font-size:15px;color:#555;margin:10px 0 0;line-height:1.6;">
        Seu pagamento foi
        <span style="color:#27ae60;font-weight:700;">aprovado</span> e seus
        ingressos estão prontos. Apresente o QR Code na entrada do evento.
      </p>
    </td>
  </tr>

  <!-- DADOS DO EVENTO -->
  <tr>
    <td style="padding:24px 40px;">
      <div style="background:#f5f0ff;border-left:4px solid #6c2bd9;
                  border-radius:8px;padding:20px;">
        <p style="margin:0 0 12px;font-size:18px;font-weight:700;color:#1a1a2e;">
          ${nomeEvento}
        </p>
        <p style="margin:0 0 6px;font-size:14px;color:#555;">
          <strong>Data:</strong> ${dataEvento} às ${horaEvento}
        </p>
        <p style="margin:0;font-size:14px;color:#555;">
          <strong>Local:</strong> ${localEvento}
        </p>
      </div>
    </td>
  </tr>

  <!-- QR CODES -->
  <tr>
    <td style="padding:0 40px 24px;">
      <h3 style="font-size:15px;color:#1a1a2e;margin:0 0 16px;
                 border-bottom:2px solid #f0edf8;padding-bottom:10px;">
        Seus Ingressos
      </h3>
      ${ingressosHtml.join("")}
    </td>
  </tr>

  <!-- RESUMO FINANCEIRO -->
  <tr>
    <td style="padding:0 40px 24px;">
      <div style="background:#fafafa;border:1px solid #eee;
                  border-radius:12px;overflow:hidden;">
        <div style="background:#6c2bd9;padding:12px 20px;">
          <span style="color:#fff;font-size:14px;font-weight:600;">
            Resumo do Pagamento
          </span>
        </div>
        <table width="100%" cellpadding="0" cellspacing="0"
               style="padding:16px 20px;">
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#555;">
              Pedido nº
            </td>
            <td align="right" style="padding:6px 0;font-size:13px;
                color:#1a1a2e;font-weight:600;">
              #${pedido_id}
            </td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#555;">
              ${nomeIngresso} × ${quantidade}
            </td>
            <td align="right" style="padding:6px 0;font-size:13px;color:#1a1a2e;">
              ${formatBRL(subtotal)}
            </td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#555;">
              Taxa de serviço (10%)
            </td>
            <td align="right" style="padding:6px 0;font-size:13px;color:#1a1a2e;">
              ${formatBRL(taxaServico)}
            </td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#555;">
              Forma de pagamento
            </td>
            <td align="right" style="padding:6px 0;font-size:13px;color:#1a1a2e;">
              ${formaPagamentoLabel}
            </td>
          </tr>
          <tr>
            <td colspan="2">
              <div style="border-top:2px solid #eee;margin:8px 0;"></div>
            </td>
          </tr>
          <tr>
            <td style="font-size:15px;font-weight:700;color:#1a1a2e;">
              Total pago
            </td>
            <td align="right" style="font-size:16px;font-weight:700;color:#6c2bd9;">
              ${formatBRL(totalPago)}
            </td>
          </tr>
        </table>
      </div>
    </td>
  </tr>

  <!-- AVISO -->
  <tr>
    <td style="padding:0 40px 32px;">
      <div style="background:#fff8e1;border:1px solid #ffe082;border-radius:8px;
                  padding:14px 18px;">
        <p style="margin:0;font-size:13px;color:#7a5c00;">
          <strong>Importante:</strong> Guarde este e-mail. O QR Code é pessoal
          e intransferível. Não compartilhe com terceiros.
        </p>
      </div>
    </td>
  </tr>

  <!-- FOOTER -->
  <tr>
    <td style="background:#1a1a2e;padding:24px 40px;text-align:center;">
      <p style="color:#fff;font-size:13px;margin:0;">
        © ${new Date().getFullYear()} Rolês Eventos — Todos os direitos reservados
      </p>
      <p style="color:rgba(255,255,255,.5);font-size:12px;margin:6px 0 0;">
        Dúvidas? Entre em contato pelo nosso suporte.
      </p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;

    // ── Gera PDF do ingresso ────────────────────────────────
    const pdfBuffer = await gerarPdfIngresso({
        pedido_id,
        nomeEvento,
        dataEvento,
        horaEvento,
        localEvento,
        nomeCliente,
        nomeIngresso,
        quantidade,
        subtotal,
        taxaServico,
        totalPago,
        forma_pagamento: formaPagamentoLabel,
        ingressos,
    });

    await transporter.sendMail({
        from:    `"Rolês Eventos" <${process.env.EMAIL_USER}>`,
        to:      emailCliente,
        subject: `Seu ingresso para ${nomeEvento} — Pedido #${pedido_id}`,
        html,
        attachments: [{
            filename:    `ingresso-pedido-${pedido_id}.pdf`,
            content:     pdfBuffer,
            contentType: "application/pdf",
        }],
    });

    console.log(`E-mail de ingresso enviado para ${emailCliente}`);
}

// ====================================================
// GERA PDF DO INGRESSO EM MEMÓRIA
// ====================================================

function gerarPdfIngresso(dados) {
    return new Promise((resolve, reject) => {
        const doc    = new PDFDocument({ margin: 50 });
        const chunks = [];

        doc.on("data",  chunk => chunks.push(chunk));
        doc.on("end",   () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        // Cabeçalho
        doc.fontSize(24).fillColor("#6c2bd9").text("Roles Eventos", { align: "center" });
        doc.moveDown(0.5);
        doc.fontSize(14).fillColor("#333").text("Comprovante de Ingresso", { align: "center" });
        doc.moveDown(1);

        // Linha divisória
        doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#6c2bd9").stroke();
        doc.moveDown(1);

        // Dados do evento
        doc.fontSize(16).fillColor("#1a1a2e").text(dados.nomeEvento);
        doc.moveDown(0.4);
        doc.fontSize(12).fillColor("#555")
           .text(`Data: ${dados.dataEvento} as ${dados.horaEvento}`)
           .text(`Local: ${dados.localEvento}`);
        doc.moveDown(1);

        // Linha divisória
        doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#ddd").stroke();
        doc.moveDown(0.8);

        // Resumo da compra
        doc.fontSize(13).fillColor("#1a1a2e").text("Resumo da Compra");
        doc.moveDown(0.5);
        doc.fontSize(11).fillColor("#555")
           .text(`Pedido n: #${dados.pedido_id}`)
           .text(`Comprador: ${dados.nomeCliente}`)
           .text(`Ingresso: ${dados.nomeIngresso} x ${dados.quantidade}`)
           .text(`Subtotal: ${formatBRL(dados.subtotal)}`)
           .text(`Taxa de servico (10%): ${formatBRL(dados.taxaServico)}`)
           .text(`Forma de pagamento: ${dados.forma_pagamento}`);
        doc.moveDown(0.5);
        doc.fontSize(14).fillColor("#6c2bd9")
           .text(`Total pago: ${formatBRL(dados.totalPago)}`, { align: "right" });
        doc.moveDown(1);

        // Ingressos / códigos QR
        doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#ddd").stroke();
        doc.moveDown(0.8);
        doc.fontSize(13).fillColor("#1a1a2e").text("Seus Ingressos");
        doc.moveDown(0.5);

        dados.ingressos.forEach((ing, i) => {
            doc.fontSize(11).fillColor("#333")
               .text(`Ingresso ${i + 1}: ${ing.tipo || dados.nomeIngresso}`)
               .text(`Codigo QR: ${ing.codigo_qr}`, { oblique: true })
               .moveDown(0.5);
        });

        // Rodapé
        doc.moveDown(1);
        doc.fontSize(9).fillColor("#999")
           .text(
               "Apresente o codigo QR na entrada do evento. Ingresso pessoal e intransferivel.",
               { align: "center" }
           );

        doc.end();
    });
}

module.exports = { enviarEmailIngresso };