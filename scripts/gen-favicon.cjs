const fs = require('fs');
const b64 = fs.readFileSync('public/logos/logo-grupo.png.jpeg').toString('base64');
const dataUri = 'data:image/jpeg;base64,' + b64;
let html = fs.readFileSync('index.html', 'utf8');
// Remove quaisquer links de icon/apple-touch-icon anteriores
html = html.replace(/\s*<link rel="icon"[^>]*>/g, '');
html = html.replace(/\s*<link rel="apple-touch-icon"[^>]*>/g, '');
// Injeta os novos favicons (data URI) logo após a tag viewport
const injection = `\n    <link rel="icon" type="image/jpeg" href="${dataUri}">\n    <link rel="apple-touch-icon" href="${dataUri}">`;
html = html.replace(/(<meta name="viewport"[^>]*>)/, `$1${injection}`);
fs.writeFileSync('index.html', html);
fs.copyFileSync('/tmp/gen-favicon.cjs', 'scripts/gen-favicon.cjs');
console.log('index.html favicon embutido. Tamanho index.html =', html.length, 'chars');
