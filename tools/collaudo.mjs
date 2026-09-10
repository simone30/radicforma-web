/* ==========================================================================
   Collaudo automatico della pagina.

   Non e' una suite di unit test: verifica i punti su cui il sito si e' gia'
   rotto una volta, o che sono difficili da controllare a occhio.

   Uso:  python3 -m http.server 8765     (in un altro terminale)
         npm install playwright && node tools/collaudo.mjs
   ========================================================================== */
import { chromium } from 'playwright';

const SITO = process.env.SITO || 'http://localhost:8765/';

const esiti = [];
const ok = (nome, passato, nota = '') => esiti.push([passato, nome, nota]);

const browser = await chromium.launch();

/* Porta lo scroll dentro un atto, alla progress voluta, e aspetta lo scrub. */
async function vaiA(pagina, sezione, q) {
  const box = await pagina.evaluate((id) => {
    const s = document.getElementById(id);
    return { top: s.getBoundingClientRect().top + scrollY, h: s.offsetHeight, vh: innerHeight };
  }, sezione);
  await pagina.evaluate((y) => scrollTo(0, y), box.top + q * (box.h - box.vh));
  await pagina.waitForTimeout(1100);
}

/* ---- 1. nessun errore in console, nessuna richiesta verso l'esterno ------- */
{
  const p = await browser.newPage({ viewport: { width: 1600, height: 950 } });
  const errori = [], esterne = [];
  p.on('console', (m) => m.type() === 'error' && errori.push(m.text()));
  p.on('pageerror', (e) => errori.push(e.message));
  p.on('request', (r) => {
    const host = new URL(r.url()).hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') esterne.push(r.url());
  });
  await p.goto(SITO, { waitUntil: 'networkidle' });
  for (let i = 0; i < 90; i++) { await p.mouse.wheel(0, 500); await p.waitForTimeout(20); }
  await p.waitForTimeout(700);
  ok('1a. nessun errore in console', errori.length === 0, errori.join(' | '));
  ok('1b. nessuna richiesta verso l\'esterno', esterne.length === 0, esterne.join(' | '));
  await p.close();
}

/* ---- 2. atto dell'incisione ---------------------------------------------- */
{
  const p = await browser.newPage({ viewport: { width: 1600, height: 950 } });
  await p.goto(SITO + '?lang=it', { waitUntil: 'networkidle' });

  const leggi = () => p.evaluate(() => {
    const scala = (el) => {
      const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
      return m.d;
    };
    return {
      burn: +scala(document.querySelector('#incisione .incisione__burn')).toFixed(3),
      raggio: parseFloat(
        document.querySelector('#incisione [data-raggio]').style.getPropertyValue('--raggio-l')) || 0,
      fuocoOp: +getComputedStyle(document.querySelector('#incisione .laser'))
        .getPropertyValue('--fuoco-op'),
    };
  });

  await vaiA(p, 'incisione', 0.02); const a = await leggi();
  await vaiA(p, 'incisione', 0.85); const b = await leggi();

  ok('2a. l\'incisione va da 0 a 1', a.burn < 0.05 && b.burn > 0.98, `${a.burn} → ${b.burn}`);

  /* il raggio deve congiungere sorgente e punto di incisione, non essere nullo */
  await vaiA(p, 'incisione', 0.45);
  const r = await p.evaluate(() => {
    const raggio = document.querySelector('#incisione [data-raggio]');
    const fuoco = document.querySelector('#incisione [data-fuoco]').getBoundingClientRect();
    const laser = document.querySelector('#incisione .laser').getBoundingClientRect();
    const l = parseFloat(raggio.style.getPropertyValue('--raggio-l'));
    const ang = parseFloat(raggio.style.getPropertyValue('--raggio-a')) * Math.PI / 180;
    const ex = laser.left + parseFloat(raggio.style.getPropertyValue('--raggio-x'));
    const ey = laser.top + parseFloat(raggio.style.getPropertyValue('--raggio-y'));
    /* dove finisce il raggio, secondo lunghezza e angolo */
    const fx = ex - Math.sin(ang) * l;
    const fy = ey + Math.cos(ang) * l;
    return { lungo: l, scarto: Math.hypot(fx - fuoco.left, fy - fuoco.top) };
  });
  ok('2b. il raggio arriva sul punto di incisione', r.lungo > 100 && r.scarto < 2,
     `lungo ${r.lungo.toFixed(0)}px, scarto ${r.scarto.toFixed(2)}px`);

  /* il marchio deve stare dentro il disco di legno */
  const g = await p.evaluate(() => {
    const l = document.querySelector('#incisione .laser__legno').getBoundingClientRect();
    const m = document.querySelector('#incisione .laser__marchio').getBoundingClientRect();
    const cx = l.x + l.width / 2, cy = l.y + l.height / 2;
    /* il disco, in prospettiva, e' un'ellisse: si normalizza sui due semiassi */
    const ax = l.width / 2, ay = l.height / 2;
    const angoli = [[m.x, m.y], [m.right, m.y], [m.x, m.bottom], [m.right, m.bottom]];
    const fuori = angoli.map(([x, y]) => Math.hypot((x - cx) / ax, (y - cy) / ay));
    return {
      quota: +Math.max(...fuori).toFixed(3),
      scartoX: +Math.abs(m.x + m.width / 2 - cx).toFixed(1),
    };
  });
  ok('2c. il marchio sta dentro il legno ed e\' centrato', g.quota < 1 && g.scartoX < 3,
     `occupa il ${(g.quota * 100).toFixed(0)}% del raggio, scarto orizzontale ${g.scartoX}px`);
  await p.close();
}

/* ---- 3. atto della stampa, e riavvolgimento ------------------------------ */
{
  const p = await browser.newPage({ viewport: { width: 1600, height: 950 } });
  await p.goto(SITO + '?lang=it', { waitUntil: 'networkidle' });

  const leggi = () => p.evaluate(() => ({
    stesi: document.querySelectorAll('#stampa .strato.e-steso').length,
    totale: document.querySelectorAll('#stampa .strato').length,
    testaSu: parseFloat(
      document.querySelector('#stampa [data-testa]').style.getPropertyValue('--testa-su')) || 0,
  }));

  await vaiA(p, 'stampa', 0.02); const a = await leggi();
  await vaiA(p, 'stampa', 0.95); const b = await leggi();
  ok('3a. gli strati si depositano tutti', a.stesi === 0 && b.stesi === b.totale && b.totale > 20,
     `${a.stesi} → ${b.stesi} di ${b.totale}`);
  ok('3b. l\'ugello sale con l\'oggetto', b.testaSu > a.testaSu + 20,
     `${a.testaSu.toFixed(0)}px → ${b.testaSu.toFixed(0)}px`);

  await vaiA(p, 'stampa', 0.02);
  const indietro = await leggi();
  ok('3c. lo scroll all\'indietro riavvolge', indietro.stesi === 0,
     `${indietro.stesi} strati ancora stesi`);
  await p.close();
}

/* ---- 4. moto ridotto: video con i comandi, testo leggibile --------------- */
{
  const p = await browser.newPage({ viewport: { width: 1600, height: 950 }, reducedMotion: 'reduce' });
  await p.goto(SITO, { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);
  const r = await p.evaluate(() => {
    const atti = [...document.querySelectorAll('[data-atto]')];
    const video = [...document.querySelectorAll('.atto__video-elemento')];
    return {
      modoVideo: atti.every((a) => a.classList.contains('atto--video')),
      videoVisibili: video.every((v) => v.getBoundingClientRect().width > 0),
      conComandi: video.every((v) => v.controls),
      inPausa: video.every((v) => v.paused),
      testiVisibili: [...document.querySelectorAll('[data-passo], .materia')]
        .every((el) => getComputedStyle(el).opacity === '1'),
    };
  });
  ok('4. moto ridotto: video fermo con i comandi, testo tutto visibile',
     r.modoVideo && r.videoVisibili && r.conComandi && r.inPausa && r.testiVisibili,
     JSON.stringify(r));
  await p.close();
}

/* ---- 5. cambio lingua ---------------------------------------------------- */
{
  const p = await browser.newPage({ viewport: { width: 1600, height: 950 } });
  await p.goto(SITO + '?lang=it', { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  await p.click('.lingua__voce[data-lang="en"]');
  await p.waitForTimeout(500);
  const en = await p.evaluate(() => ({
    lang: document.documentElement.lang,
    titoloAtto: document.querySelector('#incisione h2').textContent,
    materia: document.querySelector('#incisione .materia__nome').textContent,
    nav: document.querySelector('.navbar__link').textContent,
  }));
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  const dopo = await p.evaluate(() => document.documentElement.lang);
  ok('5. IT/EN cambia i testi e sopravvive al ricaricamento',
     en.lang === 'en' && /tenth of a millimetre/i.test(en.titoloAtto) &&
     en.materia === 'Plastic' && en.nav === 'Services' && dopo === 'en',
     JSON.stringify(en) + ' dopo il ricaricamento: ' + dopo);
  await p.close();
}

/* ---- 6. telefono: video al posto dell'animazione ------------------------- */
{
  const p = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const errori = [];
  p.on('pageerror', (e) => errori.push(e.message));
  const media = [];
  /* gli indirizzi portano il ?v= della versione: il punto interrogativo
     va previsto, altrimenti il controllo non riconosce nessun video */
  p.on('request', (r) => /\.(mp4|webm)(\?|$)/.test(r.url()) && media.push(r.url()));
  await p.goto(SITO, { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  const prima = media.length;

  await p.evaluate(() => scrollTo(0, document.getElementById('incisione').offsetTop));
  await p.waitForTimeout(1600);
  const r = await p.evaluate(() => ({
    sbordo: document.documentElement.scrollWidth > innerWidth,
    modoVideo: window.RadicForma.atti.modoVideo(),
    inRiproduzione: !document.querySelector('#incisione video').paused,
  }));
  ok('6a. telefono: nessuno sbordamento, animazione sostituita dal video',
     !r.sbordo && r.modoVideo && errori.length === 0, JSON.stringify(r) + errori.join(' | '));
  ok('6b. il video parte solo quando serve', prima === 0 && media.length > 0,
     `prima dello scroll ${prima}, dopo ${media.length}`);
  await p.close();
}

/* ---- 7. il tracciato del monogramma non e' stato duplicato --------------- */
{
  const p = await browser.newPage({ viewport: { width: 1600, height: 950 } });
  await p.goto(SITO, { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  const n = await p.evaluate(() => ({
    tracciati: document.querySelectorAll('path[id="rf-path"]').length,
    usi: document.querySelectorAll('use').length,
  }));
  ok('7. il tracciato esiste una volta sola ed e\' riusato',
     n.tracciati === 1 && n.usi > 5, `path ${n.tracciati}, use ${n.usi}`);
  await p.close();
}

/* ------------------------------------------------------------------ esito */
console.log('');
for (const [passato, nome, nota] of esiti) {
  console.log(`${passato ? 'OK     ' : 'FALLITO'}  ${nome}${nota ? '\n         ' + nota : ''}`);
}
const tutti = esiti.every(([p]) => p);
console.log('\n' + (tutti ? 'TUTTI I CONTROLLI SUPERATI' : '>>> CI SONO FALLIMENTI'));
await browser.close();
process.exit(tutti ? 0 : 1);
