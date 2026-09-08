require("dotenv").config();

const fs = require("fs");
const axios = require("axios");
const FormData = require("form-data");

async function testarSightengine() {
    try {
        console.log("=================================");
        console.log(" TESTE DA SIGHTENGINE");
        console.log("=================================");

        // Verifica se as credenciais existem
        if (
            !process.env.SIGHTENGINE_API_USER ||
            !process.env.SIGHTENGINE_API_SECRET
        ) {
            console.error("❌ Credenciais da Sightengine não encontradas.");
            console.error("Verifique o arquivo .env");
            return;
        }

        console.log("✅ Credenciais encontradas.");

        // Coloque aqui uma imagem para teste
        const caminhoImagem = "./teste.jpg";

        if (!fs.existsSync(caminhoImagem)) {
            console.error("❌ Imagem de teste não encontrada.");
            console.error(
                "Coloque uma imagem chamada 'teste.jpg' dentro da pasta backend."
            );
            return;
        }

        console.log("✅ Imagem encontrada.");
        console.log("📤 Enviando imagem para a Sightengine...");

        const form = new FormData();

        form.append("media", fs.createReadStream(caminhoImagem));

        form.append(
            "models",
            "nudity-2.1,gore-2.0,weapon,offensive"
        );

        form.append(
            "api_user",
            process.env.SIGHTENGINE_API_USER
        );

        form.append(
            "api_secret",
            process.env.SIGHTENGINE_API_SECRET
        );

        const response = await axios.post(
            "https://api.sightengine.com/1.0/check.json",
            form,
            {
                headers: form.getHeaders(),
                timeout: 30000
            }
        );

        console.log("");
        console.log("=================================");
        console.log(" ✅ RESPOSTA DA SIGHTENGINE");
        console.log("=================================");

        console.log(
            JSON.stringify(response.data, null, 2)
        );

    } catch (error) {

        console.log("");
        console.log("=================================");
        console.log(" ❌ ERRO NO TESTE");
        console.log("=================================");

        if (error.response) {

            console.error(
                "Status:",
                error.response.status
            );

            console.error(
                "Resposta:",
                JSON.stringify(
                    error.response.data,
                    null,
                    2
                )
            );

        } else {

            console.error(
                error.message
            );
        }
    }
}

testarSightengine();