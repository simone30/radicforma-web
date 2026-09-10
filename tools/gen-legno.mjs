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
 *   assets/img/legno-disco.webp       1100x1100, schermi grandi
 *   assets/img/legno-disco-900.webp    900x900
 *   assets/img/legno-disco-600.webp    600x600,  schermi piccoli
 *
 * Per usare una fotografia diversa basta passarne il percorso e adattare
 * CENTRO e LATO: il centro del ritaglio e il suo diametro.
 *
 * Il ritaglio NON e' centrato sul midollo. Nella fotografia una fessura di
 * ritiro parte dal midollo e scende fino al bordo: centrando li', quella
 * fessura taglia in due il marchio inciso. Spostandosi verso sinistra si
 * prendono anelli concentrici puliti, che alla scala ravvicinata della scena
 * si leggono comunque come legno di sezione.
 */
import sharp from 'sharp';

const ORIGINALE = process.argv[2] || 'assets/img/_sorgente-legno.jpg';
const CENTRO = { x: 1550, y: 1950 };   /* anelli puliti, a sinistra del midollo */
const LATO = 1380;                     /* diametro del ritaglio */

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

/* Le misure servono a coprire il ventaglio di srcset dichiarato in index.html.
   Oltre i 1100px il disco non guadagna nulla di visibile: e' una superficie di
   legno sfocata dalla prospettiva, e ogni raddoppio di lato costa il triplo di
   byte sulla pagina. */
for (const [nome, misura, q] of [['legno-disco.webp', 1100, 80],
                                 ['legno-disco-900.webp', 900, 80],
                                 ['legno-disco-600.webp', 600, 82]]) {
  const info = await sharp('assets/img/legno-sezione.webp')
    .resize(misura, misura, { kernel: 'lanczos3' })
    .webp({ quality: q, effort: 5 })
    .toFile(`assets/img/${nome}`);
  console.log(`${nome.padEnd(22)} ${info.width}x${info.height}  ${(info.size / 1024) | 0} KB`);
}
