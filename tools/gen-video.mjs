/* ==========================================================================
   Registra i video delle due animazioni.

   Su schermo stretto il sito non anima niente: al posto della scena a
   scorrimento mostra questi video, con il testo sotto. Sono registrati dalla
   stessa scena del sito, fotogramma per fotogramma, quindi restano allineati
   a qualunque modifica della grafica: basta rilanciare lo script.

   Come funziona:
   1. serve la cartella del progetto su una porta locale;
   2. apre la pagina a 960x960, cioe' sopra la soglia dei 900px: sotto quella
      il sito passa da solo alla versione con i video, e non ci sarebbe niente
      da registrare;
   3. spegne gli ScrollTrigger e impone la progress un fotogramma alla volta
      via window.RadicForma.atti.scrivi(), invece di simulare lo scorrimento:
      cosi' i fotogrammi sono esattamente equispaziati;
   4. nasconde testo, pannelli tecnici e velo laterale, e centra il soggetto:
      nel video il testo sta sotto, non a lato, quindi l'inquadratura cambia;
   5. codifica con ffmpeg in H.264 e VP9, e salva un fermo immagine.

   Il fermo immagine non e' l'attributo poster del video ma un fondo CSS: cosi'
   su schermo largo, dove il contenitore e' display:none, non viene scaricato.

   Uso:  npm install playwright sharp ffmpeg-static && node tools/gen-video.mjs
   ========================================================================== */
import { chromium } from 'playwright';
import sharp from 'sharp';
import ffmpeg from 'ffmpeg-static';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const esegui = promisify(execFile);
const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const USCITA = path.join(RADICE, 'assets/video');

const LATO = 960;      /* lato del video, in pixel */
const FPS = 24;
const SECONDI = 7;
const FOTOGRAMMI = FPS * SECONDI;

/* La progress non parte da 0: nei primi centesimi l'atto sta ancora entrando
   (velo e luci a zero) e il primo fotogramma sarebbe piatto. */
const DA = 0.04;
const A = 1.0;
/* L'ultimo tratto di video resta sull'oggetto finito. */
const CODA = 0.12;

const ATTI = [
  { nome: 'laser',  file: 'incisione', sezione: 'incisione', fermo: 0.78 },
  { nome: 'stampa', file: 'stampa',    sezione: 'stampa',    fermo: 0.88 },
];

/* ------------------------------------------------------------ server locale */
const TIPI = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webm': 'video/webm',
};

function avviaServer() {
  const server = http.createServer(async (req, res) => {
    try {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const file = path.join(RADICE, path.normalize(p));
      if (!file.startsWith(RADICE)) { res.writeHead(403).end(); return; }
      const dati = await fs.readFile(file);
      res.writeHead(200, { 'content-type': TIPI[path.extname(file)] || 'application/octet-stream' });
      res.end(dati);
    } catch {
      res.writeHead(404).end('non trovato');
    }
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

/* Nella registrazione il testo sta sotto al video, non a lato: il soggetto va
   riportato al centro del fotogramma e tutto il resto va via. */
const STILE_REGISTRAZIONE = `
  html, body { background: #0A0C08 !important; }
  .navbar, .hero, .atto__testo, .hud, .atto__video,
  .sezione, .footer, .skip-link { display: none !important; }
  .atto { height: 100svh !important; }
  .atto__interno { padding: 0 !important; }
  .atto__interno::before { display: none !important; }
  .laser { perspective-origin: 50% 42% !important; }
  .laser__piano { inset-inline-start: 50% !important; inset-block-start: 52% !important;
                  width: min(98%, 112vh) !important; }
  .laser__ambiente { background:
      radial-gradient(56% 46% at 50% 40%, rgba(176,138,79,.16), transparent 74%),
      radial-gradient(130% 110% at 50% 130%, rgba(0,0,0,.66), transparent 62%) !important; }
  .laser__guida { inset-inline: -14% 40% !important; }
  .sorgente { inset-inline-start: 30% !important; }
  .stampa { perspective-origin: 50% 34% !important; }
  .stampa__piano { inset-inline-start: 50% !important; inset-block-start: 62% !important;
                   width: min(150%, 160vh) !important; }
  .pila { width: 52% !important; }
  .stampa__ambiente { background:
      radial-gradient(48% 42% at 50% 60%, rgba(155,170,107,.16), transparent 74%),
      radial-gradient(130% 110% at 50% -18%, rgba(0,0,0,.7), transparent 58%) !important; }
  .stampa__rotaia { inset-block-start: 11% !important; inset-inline: 22% -18% !important; }
  .testa { inset-inline-start: 50% !important; inset-block-start: 30% !important; }
`;

/* ------------------------------------------------------------------- avvio */
const server = await avviaServer();
const porta = server.address().port;
const sito = `http://127.0.0.1:${porta}/index.html?lang=it`;
await fs.mkdir(USCITA, { recursive: true });

const browser = await chromium.launch();
const pagina = await browser.newPage({
  viewport: { width: LATO, height: LATO },
  deviceScaleFactor: 1,
});
pagina.on('pageerror', (e) => console.error('errore nella pagina:', e.message));

await pagina.goto(sito, { waitUntil: 'networkidle' });
await pagina.addStyleTag({ content: STILE_REGISTRAZIONE });
if (pagina.evaluate) {
  /* Gli ScrollTrigger riscriverebbero lo stato a ogni scorrimento, sovrascrivendo
     la progress imposta a mano. */
  await pagina.evaluate(() => {
    if (window.ScrollTrigger) window.ScrollTrigger.getAll().forEach((t) => t.kill());
  });
}
await pagina.waitForTimeout(400);

const temporanea = await fs.mkdtemp(path.join(os.tmpdir(), 'rf-video-'));

for (const atto of ATTI) {
  console.log(`\n${atto.file}: ${FOTOGRAMMI} fotogrammi a ${LATO}x${LATO}`);

  await pagina.evaluate((id) => {
    const s = document.getElementById(id);
    window.scrollTo(0, s.offsetTop);
  }, atto.sezione);
  await pagina.waitForTimeout(200);

  const cartella = path.join(temporanea, atto.file);
  await fs.mkdir(cartella, { recursive: true });

  let fermo = null;
  for (let i = 0; i < FOTOGRAMMI; i++) {
    const t = i / (FOTOGRAMMI - 1);
    /* la coda finale resta sull'oggetto finito */
    const q = t <= 1 - CODA ? t / (1 - CODA) : 1;
    const p = DA + (A - DA) * q;

    await pagina.evaluate(([nome, p]) => window.RadicForma.atti.scrivi(nome, p),
      [atto.nome, p]);

    const file = path.join(cartella, String(i).padStart(4, '0') + '.png');
    await pagina.screenshot({ path: file, clip: { x: 0, y: 0, width: LATO, height: LATO } });

    if (fermo === null && p >= atto.fermo) fermo = file;
    if (i % 24 === 0) process.stdout.write(`  ${i}/${FOTOGRAMMI}\r`);
  }

  const ingresso = path.join(cartella, '%04d.png');

  /* H.264: e' l'unico formato che tutti i telefoni riproducono, iPhone compresi */
  await esegui(ffmpeg, [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-framerate', String(FPS), '-i', ingresso,
    '-c:v', 'libx264', '-profile:v', 'high', '-crf', '23', '-preset', 'slow',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    path.join(USCITA, atto.file + '.mp4'),
  ]);

  /* VP9: piu' leggero, lo prendono i browser che lo supportano */
  await esegui(ffmpeg, [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-framerate', String(FPS), '-i', ingresso,
    '-c:v', 'libvpx-vp9', '-crf', '36', '-b:v', '0', '-row-mt', '1',
    '-pix_fmt', 'yuv420p',
    path.join(USCITA, atto.file + '.webm'),
  ]);

  /* il fermo immagine, che nel sito e' un fondo CSS */
  await sharp(fermo).resize(720).webp({ quality: 72 })
    .toFile(path.join(USCITA, atto.file + '-poster.webp'));

  for (const nome of [atto.file + '.mp4', atto.file + '.webm', atto.file + '-poster.webp']) {
    const s = await fs.stat(path.join(USCITA, nome));
    console.log(`  ${nome.padEnd(26)} ${(s.size / 1024).toFixed(0)} kB`);
  }
}

await fs.rm(temporanea, { recursive: true, force: true });
await browser.close();
server.close();
console.log('\nfatto.');
