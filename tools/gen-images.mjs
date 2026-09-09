/**
 * Genera le varianti immagine usate dal sito a partire dalla foto sorgente.
 *
 * Uso:
 *   npm install sharp        (solo in fase di setup, non serve a runtime)
 *   node tools/gen-images.mjs
 *
 * Sorgente: assets/img/legno-sezione.webp
 * Prodotti: legno-disco.webp (desktop), legno-disco-600.webp (mobile)
 *
 * CROP: le coordinate qui sotto ritagliano la superficie di taglio dalla foto
 * attuale (600x900). Sostituendo la foto con una versione ad alta risoluzione
 * vanno ricalcolate: servono il centro del disco e un raggio che includa un po'
 * di corteccia. Imposta CROP = null per usare l'immagine intera già quadrata.
 */
import sharp from 'sharp';

const SRC = 'assets/img/legno-sezione.webp';
const CROP = { left: 160, top: 470, width: 370, height: 370 };

const src = CROP ? sharp(SRC).extract(CROP) : sharp(SRC);
const meta = await sharp(SRC).metadata();
console.log(`sorgente ${meta.width}x${meta.height}`);

if (meta.width < 1400) {
  console.warn(
    '\n  ATTENZIONE: la foto sorgente e\' a bassa risoluzione (anteprima stock).\n' +
    '  Sostituirla con una versione licenziata prima della pubblicazione.\n'
  );
}

for (const [out, size] of [['legno-disco.webp', 900], ['legno-disco-600.webp', 600]]) {
  const info = await src
    .clone()
    .resize(size, size, { kernel: 'lanczos3' })
    .sharpen({ sigma: 0.7 })
    .webp({ quality: 82 })
    .toFile(`assets/img/${out}`);
  console.log(`${out.padEnd(22)} ${info.width}x${info.height}  ${(info.size / 1024) | 0} KB`);
}
