"use strict";

const fs   = require("fs");
const path = require("path");

const LOGO_PATH = path.join(__dirname, "../../Frontend/imagens/logo-roles.png");

function wrapEmail(conteudo) {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0edf8;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;background:#f0edf8;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0"
       style="background:#fff;border-radius:16px;overflow:hidden;
              box-shadow:0 4px 24px rgba(108,43,217,.12);max-width:600px;">
  <tr>
    <td style="background:linear-gradient(135deg,#6c2bd9 0%,#9b59b6 100%);padding:40px;text-align:center;">
      <img src="cid:logo_roles" alt="Rolês"
           style="width:60px;height:60px;border-radius:12px;margin-bottom:12px;display:block;margin-left:auto;margin-right:auto;" />
      <h1 style="color:#fff;margin:0;font-size:26px;letter-spacing:1px;">Rolês</h1>
    </td>
  </tr>
  ${conteudo}
  <tr>
    <td style="background:#1a1a2e;padding:24px 40px;text-align:center;">
      <p style="color:#fff;font-size:13px;margin:0;">© ${new Date().getFullYear()} Rolês Eventos — Todos os direitos reservados</p>
      <p style="color:rgba(255,255,255,.5);font-size:12px;margin:6px 0 0;">Dúvidas? Entre em contato pelo nosso suporte.</p>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

const logoAttachment = {
    filename: "logo.png",
    path: LOGO_PATH,
    cid: "logo_roles"
};

module.exports = { wrapEmail, logoAttachment };