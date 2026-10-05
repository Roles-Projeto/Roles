const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;

if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
} else {
    console.warn("Aviso: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas no .env — upload para o Supabase Storage ficará indisponível até configurar.");
}

module.exports = supabase;