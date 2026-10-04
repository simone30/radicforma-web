/* ==========================================================================
   Marca gli indirizzi degli asset con la versione del loro contenuto.

   PERCHE' SERVE
   Il dominio passa dal proxy di Cloudflare, che tiene in cache CSS,
   JavaScript, immagini e video per ore, mentre l'HTML lo lascia passare.
   Dopo una pubblicazione questo produce il caso peggiore: markup nuovo con
   fogli di stile e codice vecchi. La pagina non e' rotta a meta', e' rotta
   del tutto, e da fuori sembra che la pubblicazione non sia andata a buon
   fine.

   Aggiungendo ?v=<impronta> agli indirizzi, un file cambiato diventa un
   indirizzo nuovo, che nessuna cache puo' avere: si aggiorna da solo, senza
   svuotare niente a mano e senza dipendere da come e' configurato il proxy.

   L'impronta e' una sola per tutto il sito ed e' calcolata sul contenuto dei
   file marcati: finche' non si tocca niente resta identica, quindi rilanciare
   lo script non produce un diff inutile.

   COSA NON MARCA
   I caratteri tipografici. Il loro indirizzo compare due volte — nel preload
   dell'HTML e nella regola @font-face del CSS — e marcarne uno solo farebbe
   scaricare il file due volte. Cambiano quasi mai, e il CSS che li richiama
   e' comunque marcato.

   Uso:  node tools/marca-versioni.mjs
         node tools/marca-versioni.mjs --check   (verifica soltanto)
   ========================================================================== */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/* Tutte le pagine del sito: devono avere la stessa versione, perche' i file
   che richiamano sono gli stessi. */
const PAGINE = ['index.html', 'lavori.html'];
const SOLO_VERIFICA = process.argv.includes('--check');

/* Le cartelle il cui contenuto entra nell'impronta e i cui indirizzi vengono
   marcati. I font sono esclusi di proposito, vedi sopra. */
const CARTELLE = ['assets/css', 'assets/js', 'assets/vendor', 'assets/img',
                  'assets/video', 'assets/i18n', 'assets/data'];

/* Scende anche nelle sottocartelle: le foto dei lavori stanno in
   assets/img/lavori/ e i loro indirizzi li costruisce lavori.js a runtime,
   con la stessa versione. Se non entrassero nell'impronta, una foto
   sostituita resterebbe quella vecchia in cache. */
async function file(cartella) {
  const dir = path.join(RADICE, cartella);
  let voci;
  try { voci = await fs.readdir(dir, { withFileTypes: true }); }
  catch { return []; }
  const visibili = voci.filter((v) => !v.name.startsWith('_') && !v.name.startsWith('.'));
  const sotto = await Promise.all(visibili.filter((v) => v.isDirectory())
    .map((v) => file(path.join(cartella, v.name))));
  return visibili.filter((v) => v.isFile())
    .map((v) => path.join(cartella, v.name))
    .concat(sotto.flat())
    .sort();
}

const elenco = (await Promise.all(CARTELLE.map(file))).flat();

const impronta = crypto.createHash('sha256');
for (const f of elenco) {
  impronta.update(f);
  impronta.update(await fs.readFile(path.join(RADICE, f)));
}
const versione = impronta.digest('hex').slice(0, 8);

/* --- riscrittura degli indirizzi ---------------------------------------- */
/* Un indirizzo verso una delle cartelle marcate, con o senza ?v= gia' presente.
   Si riscrive il ?v= esistente invece di accodarne un altro, cosi' lo script
   e' rilanciabile. */
const cartelleRegex = CARTELLE.map((c) => c.replace('assets/', '')).join('|');
const indirizzo = new RegExp(
  `(\\./assets/(?:${cartelleRegex})/[A-Za-z0-9._-]+)(\\?v=[0-9a-f]+)?`, 'g');

const daRimarcare = [];
let marcati = 0;

for (const nome of PAGINE) {
  const pagina = path.join(RADICE, nome);
  const prima = await fs.readFile(pagina, 'utf8');

  let html = prima.replace(indirizzo, (tutto, percorso) => `${percorso}?v=${versione}`);

  /* i18n.js e lavori.js costruiscono indirizzi a runtime: la versione gliela
     si passa da qui, sull'elemento radice. */
  html = html.replace(/<html lang="([a-z-]+)"(?: data-versione="[0-9a-f]+")?>/,
                      `<html lang="$1" data-versione="${versione}">`);

  marcati += (html.match(/\?v=/g) || []).length;
  if (html === prima) continue;
  daRimarcare.push(nome);
  if (!SOLO_VERIFICA) await fs.writeFile(pagina, html);
}

if (SOLO_VERIFICA) {
  if (daRimarcare.length === 0) {
    console.log(`allineato — versione ${versione}, ${marcati} indirizzi marcati`);
    process.exit(0);
  }
  console.error(`DA RIMARCARE (${daRimarcare.join(', ')}) — la versione dovrebbe essere ${versione}`);
  console.error('esegui: node tools/marca-versioni.mjs');
  process.exit(1);
}

if (daRimarcare.length === 0) {
  console.log(`gia' allineato — versione ${versione}, ${marcati} indirizzi marcati`);
} else {
  console.log(`versione ${versione} — ${marcati} indirizzi marcati in ${PAGINE.join(', ')}`);
  console.log(`(impronta calcolata su ${elenco.length} file)`);
}
