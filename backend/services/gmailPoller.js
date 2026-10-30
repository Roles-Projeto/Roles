// =====================================================
//  backend/services/gmailPoller.js
// =====================================================

const { google } = require("googleapis");
const connection  = require("../db/db_config");

const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI
);

oauth2Client.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN,
});

const gmail = google.gmail({ version: "v1", auth: oauth2Client });

function extrairProtocolo(texto) {
    const match = texto?.match(/Protocolo\s*#(\d+)/i);
    return match ? parseInt(match[1]) : null;
}

function decodificarCorpo(payload) {
    let corpo = "";
    if (payload.parts) {
        for (const part of payload.parts) {
            if (part.mimeType === "text/plain" && part.body?.data) {
                corpo = Buffer.from(part.body.data, "base64url").toString("utf-8");
                break;
            }
        }
    } else if (payload.body?.data) {
        corpo = Buffer.from(payload.body.data, "base64url").toString("utf-8");
    }
    return corpo.trim();
}

async function verificarRespostas() {
    try {
        const dezMinutosAtras = Math.floor(Date.now() / 1000) - 10 * 60;

        const lista = await gmail.users.messages.list({
            userId: "me",
            q: `after:${dezMinutosAtras} is:unread -from:me`,
            maxResults: 20,
        });

        const mensagens = lista.data.messages || [];

        for (const msg of mensagens) {
            const detalhe = await gmail.users.messages.get({
                userId: "me",
                id: msg.id,
                format: "full",
            });

            const headers = detalhe.data.payload.headers;
            const assunto = headers.find(h => h.name === "Subject")?.value || "";
            const de      = headers.find(h => h.name === "From")?.value || "";
            const corpo   = decodificarCorpo(detalhe.data.payload);

            if (de.includes(process.env.EMAIL_USER)) continue;

            const contatoId = extrairProtocolo(assunto + " " + corpo);
            if (!contatoId) continue;

            connection.query(
                "SELECT id FROM contato_respostas WHERE gmail_message_id = ?",
                [msg.id],
                (err, rows) => {
                    if (err || rows.length > 0) return;

                    connection.query(
                        `INSERT INTO contato_respostas (contato_id, remetente, mensagem, gmail_message_id)
                         VALUES (?, 'usuario', ?, ?)`,
                        [contatoId, corpo, msg.id],
                        (err2) => {
                            if (err2) {
                                console.error("Erro ao salvar resposta:", err2.message);
                                return;
                            }
                            console.log(`✅ Resposta do usuário salva — Protocolo #${contatoId}`);

                            gmail.users.messages.modify({
                                userId: "me",
                                id: msg.id,
                                requestBody: { removeLabelIds: ["UNREAD"] },
                            });
                        }
                    );
                }
            );
        }
    } catch (err) {
        console.error("Erro no Gmail Poller:", err.message);
    }
}

function iniciarPoller() {
    console.log("📬 Gmail Poller iniciado — verificando a cada 5 minutos");
    verificarRespostas();
    setInterval(verificarRespostas, 5 * 60 * 1000);
}

module.exports = { iniciarPoller };

