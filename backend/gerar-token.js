require("dotenv").config();
const { google } = require("googleapis");
const readline = require("readline");

const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    "http://localhost"
);

const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://mail.google.com/"],
    prompt: "consent"
});

console.log("\n👉 Acesse essa URL no navegador:\n");
console.log(url);
console.log("\nDepois cole o código aqui:");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question("Código: ", async (code) => {
    const { tokens } = await oauth2Client.getToken(code);
    console.log("\n✅ Seu Refresh Token:\n");
    console.log(tokens.refresh_token);
    rl.close();
});



