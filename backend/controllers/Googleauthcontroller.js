/**
 * Login / cadastro com Google
 *
 * Rota: POST /usuarios/google
 * Body: { credential: "<ID token do Google>" }
 *
 * Resposta (mesmo formato que o Login.js espera no concluirLogin):
 *   { id, token, nome_completo, foto_perfil, email }
 *
 * Dependência: npm i google-auth-library
 * Variáveis de ambiente: GOOGLE_CLIENT_ID, JWT_SECRET
 */

const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");
const db = require("../db/db_config");

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);


/*
 * db.query pode devolver { rows } (pg) ou o array direto,
 * dependendo de como o db_config foi escrito.
 */
function linhas(resultado) {
    return Array.isArray(resultado)
        ? resultado
        : (resultado && resultado.rows) || [];
}


async function buscarUsuario(googleId, email) {

    const resultado = await db.query(
        "SELECT * FROM usuarios WHERE google_id = ? OR email = ? LIMIT 1",
        [googleId, email]
    );

    return linhas(resultado)[0];
}


exports.loginGoogle = async (req, res) => {

    try {

        const { credential } = req.body || {};

        if (!credential) {
            return res.status(400).json({ erro: "Token do Google ausente." });
        }


        /* Valida assinatura, expiração e audience do token */
        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();

        const googleId = payload.sub;
        const email = payload.email;
        const nome = payload.name || email;
        const foto = payload.picture || null;


        if (!email || !payload.email_verified) {
            return res.status(401).json({
                erro: "O e-mail da conta Google não está verificado."
            });
        }


        let usuario = await buscarUsuario(googleId, email);


        if (!usuario) {

            /* Cadastro automático */
          await db.query(
    `INSERT INTO usuarios (nome_completo, email, google_id, foto_perfil, verificado)
     VALUES (?, ?, ?, ?, ?)`,
    [nome, email, googleId, foto, 1]
);
            usuario = await buscarUsuario(googleId, email);

        } else if (!usuario.google_id) {

            /* Conta já existia por e-mail/senha: vincula o Google a ela */
            await db.query(
                "UPDATE usuarios SET google_id = ? WHERE id = ?",
                [googleId, usuario.id]
            );
        }


        if (!usuario) {
            return res.status(500).json({ erro: "Não foi possível criar a conta." });
        }


        /*
         * IMPORTANTE: gere o token do mesmo jeito que o
         * authController.loginUsuario (mesmo payload e expiração),
         * senão o middleware de autenticação pode rejeitá-lo.
         */
        const token = jwt.sign(
            { id: usuario.id, email: usuario.email },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );


        return res.json({
            id: usuario.id,
            token,
            nome_completo: usuario.nome_completo || nome,
            foto_perfil: usuario.foto_perfil || foto || "",
            email: usuario.email
        });


    }      catch (err) {

        console.error("❌ Erro no login com Google:", err.message);

        const erroDeToken =
            /token|audience|recipient|signature|expired|jwt|Wrong/i.test(err.message || "");

        return res.status(erroDeToken ? 401 : 500).json({
            erro: erroDeToken
                ? "Token do Google inválido ou expirado."
                : "Erro interno ao entrar com o Google. Tente novamente."
        });
    }
};