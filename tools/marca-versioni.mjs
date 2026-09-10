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
const PAGINA = path.join(RADICE, 'index.html');
const SOLO_VERIFICA = process.argv.includes('--check');

/* Le cartelle il cui contenuto entra nell'impronta e i cui indirizzi vengono
   marcati. I font sono esclusi di proposito, vedi sopra. */
const CARTELLE = ['assets/css', 'assets/js', 'assets/vendor', 'assets/img',
                  'assets/video', 'assets/i18n'];

async function file(cartella) {
  const dir = path.join(RADICE, cartella);
  let voci;
  try { voci = await fs.readdir(dir, { withFileTypes: true }); }
  catch { return []; }
  return voci
    .filter((v) => v.isFile() && !v.name.startsWith('_') && !v.name.startsWith('.'))
    .map((v) => path.join(cartella, v.name))
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
let html = await fs.readFile(PAGINA, 'utf8');
const prima = html;

/* Un indirizzo verso una delle cartelle marcate, con o senza ?v= gia' presente.
   Si riscrive il ?v= esistente invece di accodarne un altro, cosi' lo script
   e' rilanciabile. */
const cartelleRegex = CARTELLE.map((c) => c.replace('assets/', '')).join('|');
const indirizzo = new RegExp(
  `(\\./assets/(?:${cartelleRegex})/[A-Za-z0-9._-]+)(\\?v=[0-9a-f]+)?`, 'g');

html = html.replace(indirizzo, (tutto, percorso) => `${percorso}?v=${versione}`);

/* i18n.js costruisce l'indirizzo dei dizionari a runtime: la versione gliela
   si passa da qui, sull'elemento radice. */
html = html.replace(/<html lang="([a-z-]+)"(?: data-versione="[0-9a-f]+")?>/,
                    `<html lang="$1" data-versione="${versione}">`);

const marcati = (html.match(/\?v=/g) || []).length;

if (SOLO_VERIFICA) {
  if (html === prima) {
    console.log(`allineato — versione ${versione}, ${marcati} indirizzi marcati`);
    process.exit(0);
  }
  console.error(`DA RIMARCARE — la versione dovrebbe essere ${versione}`);
  console.error('esegui: node tools/marca-versioni.mjs');
  process.exit(1);
}

if (html === prima) {
  console.log(`gia' allineato — versione ${versione}, ${marcati} indirizzi marcati`);
} else {
  await fs.writeFile(PAGINA, html);
  console.log(`versione ${versione} — ${marcati} indirizzi marcati in index.html`);
  console.log(`(impronta calcolata su ${elenco.length} file)`);
}
