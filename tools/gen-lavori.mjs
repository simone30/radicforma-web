/**
 * Prepara le foto dei lavori per la home e per lavori.html.
 *
 * Prende una cartella di foto originali (jpg, png, webp, tiff) e per ognuna
 * scrive in assets/img/lavori/ due versioni webp:
 *   <nome>-640.webp    schede della striscia e della galleria
 *   <nome>-1280.webp   schermi densi e foto a tutto schermo
 * Le foto non vengono mai ingrandite: un originale piu' piccolo resta della
 * sua misura. L'orientamento del telefono (EXIF) viene applicato, i metadati
 * (posizione GPS compresa) vengono tolti.
 *
 * <nome> e' il nome del file originale, in minuscolo e senza accenti né
 * spazi: "Tagliere Noce 2.JPG" diventa "tagliere-noce-2".
 *
 * Poi aggiorna assets/data/lavori.json:
 *   - per una foto gia' elencata riscrive solo le misure (w, h);
 *   - una foto nuova la aggiunge in fondo, con il titolo ricavato dal nome
 *     e categoria e materiale da completare a mano.
 * Le voci scritte a mano non vengono toccate.
 *
 * Uso:
 *   npm install sharp
 *   node tools/gen-lavori.mjs <cartella-originali>
 *   node tools/marca-versioni.mjs          (sempre, prima di pubblicare)
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const USCITA = path.join(RADICE, 'assets/img/lavori');
const ELENCO = path.join(RADICE, 'assets/data/lavori.json');
const LARGHEZZE = [640, 1280];
const QUALITA = 80;
const ESTENSIONI = new Set(['.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff']);

const sorgente = process.argv[2];
if (!sorgente) {
  console.error('uso: node tools/gen-lavori.mjs <cartella-originali>');
  process.exit(1);
}

function nomeFile(file) {
  return path.parse(file).name
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function titoloDa(nome) {
  const t = nome.replace(/-/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const originali = (await fs.readdir(sorgente))
  .filter((f) => ESTENSIONI.has(path.extname(f).toLowerCase()))
  .sort();
if (!originali.length) {
  console.error(`nessuna foto in ${sorgente}`);
  process.exit(1);
}

await fs.mkdir(USCITA, { recursive: true });
const dati = JSON.parse(await fs.readFile(ELENCO, 'utf8'));
const lavori = dati.lavori;

for (const file of originali) {
  const nome = nomeFile(file);
  const ingresso = path.join(sorgente, file);
  let misure = null;

  for (const larghezza of LARGHEZZE) {
    const info = await sharp(ingresso)
      .rotate()
      .resize({ width: larghezza, withoutEnlargement: true })
      .webp({ quality: QUALITA })
      .toFile(path.join(USCITA, `${nome}-${larghezza}.webp`));
    misure = { w: info.width, h: info.height };   /* resta quella grande */
  }

  const voce = lavori.find((l) => l.foto === nome);
  if (voce) {
    Object.assign(voce, misure);
    console.log(`aggiornata  ${nome}  ${misure.w}x${misure.h}`);
  } else {
    lavori.push({
      foto: nome,
      ...misure,
      categoria: '',
      home: false,
      titolo:    { it: titoloDa(nome), en: '' },
      materiale: { it: '', en: '' },
      alt:       { it: '', en: '' },
    });
    console.log(`nuova       ${nome}  ${misure.w}x${misure.h}  → completare in lavori.json`);
  }
}

await fs.writeFile(ELENCO, JSON.stringify(dati, null, 2) + '\n');
console.log(`\n${originali.length} foto in assets/img/lavori/, elenco aggiornato.`);
console.log('Ora: completa categoria, titoli e materiali, poi node tools/marca-versioni.mjs');
