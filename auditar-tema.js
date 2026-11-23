/* ==========================================================
   AUDITORIA DO MODO ESCURO — Rolês
   Rode na raiz do projeto (só LÊ, não altera nada):

     node auditar-tema.js frontend

   Relatório:
   1) Páginas HTML sem o tema (tema.js / tema.css / script do <head>)
   2) Cores claras fixas que sobraram nos CSS
   3) Cores fixas "inline" em HTML e JS (style="..." / el.style...)
   4) Páginas que rodam dentro de <iframe> (precisam do tema também)
========================================================== */
const fs = require('fs');
const path = require('path');

const raiz = process.argv[2];
if (!raiz) { console.log('Uso: node auditar-tema.js <pasta>'); process.exit(1); }

const IGNORAR_DIR = ['node_modules', '.git', 'imagens', 'img', 'assets', 'uploads'];
const IGNORAR_ARQ = ['header.css', 'tema.css', 'tema-home.css', 'tema.js', 'acessibilidade.js'];

function listar(dir) {
  let out = [];
  for (const nome of fs.readdirSync(dir)) {
    const p = path.join(dir, nome);
    const st = fs.statSync(p);
    if (st.isDirectory()) { if (!IGNORAR_DIR.includes(nome)) out = out.concat(listar(p)); }
    else out.push(p);
  }
  return out;
}

const arquivos = listar(raiz);
const html = arquivos.filter(f => f.endsWith('.html'));
const css  = arquivos.filter(f => f.endsWith('.css') && !IGNORAR_ARQ.includes(path.basename(f)) && !f.endsWith('.bak'));
const js   = arquivos.filter(f => f.endsWith('.js')  && !IGNORAR_ARQ.includes(path.basename(f)));

const ler = f => fs.readFileSync(f, 'utf8');
const linhaDe = (txt, idx) => txt.slice(0, idx).split('\n').length;

/* ---------- 1) Páginas sem tema ---------- */
console.log('\n=== 1) PÁGINAS HTML ===');
let semTema = 0;
for (const f of html) {
  const t = ler(f);
  // fragmentos (header/footer/widgets) não têm <head>: ignora
  if (!/<head[\s>]/i.test(t)) continue;
  const falta = [];
  if (!/tema\.js/.test(t)) falta.push('tema.js');
  if (!/tema\.css/.test(t)) falta.push('tema.css');
  if (!/roles_tema/.test(t)) falta.push('script inline do <head>');
  if (!/header\.css/.test(t) && /header-container/.test(t)) falta.push('header.css');
  if (falta.length) { semTema++; console.log(`✖ ${f}\n    falta: ${falta.join(', ')}`); }
}
if (!semTema) console.log('✔ Todas as páginas com <head> têm o tema.');

/* ---------- 2) Cores claras fixas nos CSS ---------- */
console.log('\n=== 2) CORES CLARAS FIXAS NOS CSS ===');
const PADROES_CSS = [
  /background(?:-color)?\s*:\s*(?:#fff(?:fff)?|white)\b[^;}]*/gi,
  /background(?:-color)?\s*:\s*#(?:f[0-9a-f]){3}\b[^;}]*/gi,
  /(?<![-\w])color\s*:\s*(?:#000(?:000)?|#111|#1a1a1a|#222(?:222)?|#333(?:333)?|black)\b[^;}]*/gi,
  /(?<![-\w])color\s*:\s*(?:#444|#555|#666|#777|#888|#999)(?:[0-9a-f]{3})?\b[^;}]*/gi,
];
let totalCss = 0;
for (const f of css) {
  const t = ler(f);
  const achados = [];
  for (const re of PADROES_CSS) {
    let m; re.lastIndex = 0;
    while ((m = re.exec(t))) achados.push(`  linha ${linhaDe(t, m.index)}: ${m[0].trim()}`);
  }
  if (achados.length) {
    totalCss += achados.length;
    console.log(`• ${f} (${achados.length})`);
    achados.slice(0, 8).forEach(a => console.log(a));
    if (achados.length > 8) console.log(`  ... +${achados.length - 8}`);
  }
}
if (!totalCss) console.log('✔ Nenhuma cor clara fixa encontrada.');

/* ---------- 3) Inline em HTML e JS ---------- */
console.log('\n=== 3) CORES FIXAS INLINE (HTML/JS) ===');
const PADROES_INLINE = [
  /style\s*=\s*["'][^"']*(?:background|color|border)[^"']*#[0-9a-f]{3,8}[^"']*["']/gi,
  /style\.(?:background|backgroundColor|color|borderColor)\s*=\s*["'`]#?[a-z0-9(),. ]+["'`]/gi,
  /(?:background|color)\s*:\s*(?:#fff(?:fff)?|white|#000(?:000)?|black|#333|#222)\b/gi,
];
let totalInline = 0;
for (const f of [...html, ...js]) {
  const t = ler(f);
  const vistos = new Set();
  const achados = [];
  for (const re of PADROES_INLINE) {
    let m; re.lastIndex = 0;
    while ((m = re.exec(t))) {
      const l = linhaDe(t, m.index);
      if (vistos.has(l)) continue;
      vistos.add(l);
      achados.push(`  linha ${l}: ${m[0].replace(/\s+/g, ' ').slice(0, 90)}`);
    }
  }
  if (achados.length) {
    totalInline += achados.length;
    console.log(`• ${f} (${achados.length})`);
    achados.slice(0, 6).forEach(a => console.log(a));
    if (achados.length > 6) console.log(`  ... +${achados.length - 6}`);
  }
}
if (!totalInline) console.log('✔ Nada inline encontrado.');

/* ---------- 4) iframes ---------- */
console.log('\n=== 4) IFRAMES (documento separado: precisa do tema próprio) ===');
let ifr = 0;
for (const f of html) {
  const t = ler(f);
  const re = /<iframe[^>]*src\s*=\s*["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(t))) { ifr++; console.log(`• ${f} -> ${m[1]}`); }
}
if (!ifr) console.log('✔ Nenhum iframe.');

console.log(`\nResumo: ${semTema} página(s) sem tema | ${totalCss} cor(es) fixa(s) em CSS | ${totalInline} inline em HTML/JS | ${ifr} iframe(s)`);