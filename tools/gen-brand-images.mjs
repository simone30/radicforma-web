/**
 * Genera l'immagine di anteprima social e le favicon dal monogramma di brand.
 *
 * Uso:
 *   npm install sharp playwright && npx playwright install chromium
 *   node tools/gen-brand-images.mjs
 *   (serve un server statico locale sulla porta indicata da PORTA)
 *
 * Prodotti:
 *   assets/img/og-image.png    1200x630, lockup su fondo Verde Corteccia
 *   favicon.svg                monogramma, vettoriale
 *   apple-touch-icon.png       180x180, per iOS
 *
 * L'anteprima social viene fotografata da un browser vero: i motori SVG da
 * riga di comando non applicano @font-face, e il nome del marchio uscirebbe
 * con un serif di sistema invece che in Cormorant Garamond.
 *
 * Il tracciato viene letto dall'asset di brand: non e' ridisegnato qui.
 */
import sharp from 'sharp';
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';

const PORTA = process.env.PORTA || 8765;
const CORTECCIA = '#22281F';
const FOGLIA = '#9BAA6B';
const AVORIO = '#EDE9DB';

const brand = readFileSync('assets/brand/monogramma-light.svg', 'utf8');
const d = brand.match(/<path\b[^>]*\sd="([^"]+)"/)[1];

/* --------------------------------------------------------------- og-image */
const pagina = `<!DOCTYPE html><meta charset="utf-8"><style>
  @font-face { font-family:'Cormorant Garamond';
    src:url('./assets/fonts/cormorant-garamond-latin-500.woff2') format('woff2'); }
  @font-face { font-family:'Manrope';
    src:url('./assets/fonts/manrope-latin-500.woff2') format('woff2'); }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:1200px; height:630px; background:${CORTECCIA};
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    font-kerning:normal; -webkit-font-smoothing:antialiased; overflow:hidden; }
  body::before { content:''; position:absolute; inset:0;
    background:radial-gradient(58% 50% at 50% 40%, rgba(176,138,79,.17), transparent 70%); }
  svg.mono { width:230px; margin-bottom:26px; position:relative; }
  h1 { font-family:'Cormorant Garamond',serif; font-weight:500; font-size:76px;
    letter-spacing:18px; color:${AVORIO}; text-indent:18px; position:relative; }
  p.claim { font-family:'Manrope',sans-serif; font-weight:500; font-size:21px;
    letter-spacing:8px; color:${FOGLIA}; text-indent:8px; margin-top:14px; position:relative; }
  p.desc { font-family:'Manrope',sans-serif; font-weight:500; font-size:18px;
    letter-spacing:5px; color:#8C8F86; text-indent:5px; margin-top:52px; position:relative; }
</style>
<svg class="mono" viewBox="0 0 477 383"><path d="${d}" fill="${FOGLIA}" fill-rule="evenodd"/></svg>
<h1>RADIC FORMA</h1>
<p class="claim">DOVE LA MATERIA PRENDE VITA</p>
<p class="desc">MODELLI 3D · INCISIONI LASER</p>`;

writeFileSync('_og.html', pagina);
try {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.goto(`http://localhost:${PORTA}/_og.html`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: 'assets/img/og-image.png' });
  await browser.close();
} finally {
  unlinkSync('_og.html');
}
const og = await sharp('assets/img/og-image.png').metadata();
console.log(`og-image.png           ${og.width}x${og.height}  ${(og.size / 1024) | 0} KB`);

/* ---------------------------------------------------------------- favicon
   Il monogramma e' largo 477 e alto 383: per stare in un quadrato viene
   centrato in un viewBox 477x477 senza deformarlo. */
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 477 477">
  <rect width="477" height="477" rx="72" fill="${CORTECCIA}"/>
  <g transform="translate(0 47)"><path d="${d}" fill="${FOGLIA}" fill-rule="evenodd"/></g>
</svg>`;
writeFileSync('favicon.svg', favicon);
console.log('favicon.svg            vettoriale');

const touch = await sharp(Buffer.from(favicon)).resize(180, 180).png().toFile('apple-touch-icon.png');
console.log(`apple-touch-icon.png   ${touch.width}x${touch.height}  ${(touch.size / 1024) | 0} KB`);
