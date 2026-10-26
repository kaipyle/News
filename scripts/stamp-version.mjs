#!/usr/bin/env node
// Carimba a versão publicada, para o celular nunca misturar arquivos de versões diferentes:
// - version.json: o app compara com a versão que está rodando e recarrega quando muda;
// - index.html: app.css e app.js ganham "?v=<versão>", então uma página nova sempre busca
//   o CSS e o JS novos (e uma página antiga em cache continua com os antigos, sem quebrar).
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const version = (process.env.GITHUB_SHA || `dev-${Date.now()}`).slice(0, 12);

await writeFile(join(PUBLIC, 'version.json'), JSON.stringify({ app: version, builtAt: Date.now() }));
const file = join(PUBLIC, 'index.html');
const html = await readFile(file, 'utf8');
const stamped = html.replace(/(href|src)="(app\.(?:css|js))(?:\?v=[^"]*)?"/g, `$1="$2?v=${version}"`);
if (stamped === html) throw new Error('index.html sem referências a app.css/app.js para carimbar');
await writeFile(file, stamped);
console.log(`versão ${version} carimbada`);
