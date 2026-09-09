/**
 * Prepara la sezione di tronco usata dalla scena.
 *
 * Sorgente: fotografia di una sezione di abete di Douglas, licenza CC0
 * (nessun vincolo, uso commerciale libero, nessuna attribuzione dovuta).
 * Vedi assets/img/CREDITI.md.
 *
 * L'originale e' un reperto didattico con dei cartellini applicati sopra: il
 * ritaglio circolare qui sotto e' scelto per escluderli e per tenere il midollo
 * leggermente decentrato, come in un tronco vero. Il legno e' verniciato e
 * vira all'arancione, quindi la saturazione viene riportata a toni naturali.
 *
 * Uso:
 *   npm install sharp
 *   node tools/gen-legno.mjs [percorso-originale]
 *
 * Prodotti:
 *   assets/img/legno-sezione.webp     1450x1450, sorgente ritagliata
 *   assets/img/legno-disco.webp       1400x1400, desktop
 *   assets/img/legno-disco-600.webp    600x600,  schermi piccoli
 *
 * Per usare una fotografia diversa basta passarne il percorso e adattare
 * CENTRO e LATO: il centro va sul midollo, il lato e' il diametro del ritaglio.
 */
import sharp from 'sharp';

const ORIGINALE = process.argv[2] || 'assets/img/_sorgente-legno.jpg';
const CENTRO = { x: 2250, y: 1750 };   /* il midollo nell'originale */
const LATO = 1450;                     /* diametro del ritaglio */

const meta = await sharp(ORIGINALE).metadata();
console.log(`sorgente ${meta.width}x${meta.height}`);

const maschera = Buffer.from(
  `<svg width="${LATO}" height="${LATO}">` +
  `<circle cx="${LATO / 2}" cy="${LATO / 2}" r="${LATO / 2 - 2}" fill="#fff"/></svg>`
);

/* Ritaglio tondo e colore riportato a un bruno naturale: l'originale e'
   lucidato e troppo saturo per stare accanto ai verdi del marchio.
   La maschera si applica a piena risoluzione, prima di qualsiasi resize. */
await sharp(ORIGINALE)
  .extract({ left: CENTRO.x - LATO / 2, top: CENTRO.y - LATO / 2, width: LATO, height: LATO })
  .modulate({ saturation: 0.62, brightness: 1.1, hue: 6 })
  .linear(1.06, -10)
  .composite([{ input: maschera, blend: 'dest-in' }])
  .webp({ quality: 92, effort: 5 })
  .toFile('assets/img/legno-sezione.webp');

const sorgente = await sharp('assets/img/legno-sezione.webp').metadata();
console.log(`legno-sezione.webp     ${sorgente.width}x${sorgente.height}  ${(sorgente.size / 1024) | 0} KB`);

for (const [nome, misura, q] of [['legno-disco.webp', 1400, 88], ['legno-disco-600.webp', 600, 86]]) {
  const info = await sharp('assets/img/legno-sezione.webp')
    .resize(misura, misura, { kernel: 'lanczos3' })
    .webp({ quality: q, effort: 5 })
    .toFile(`assets/img/${nome}`);
  console.log(`${nome.padEnd(22)} ${info.width}x${info.height}  ${(info.size / 1024) | 0} KB`);
}
