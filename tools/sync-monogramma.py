#!/usr/bin/env python3
"""Copia il tracciato del monogramma dall'asset di brand dentro index.html.

Il sito usa un solo <path id="rf-path"> richiamato via <use>. Questo script lo
tiene allineato al file di brand, cosi' il tracciato pubblicato e' sempre
identico all'originale, byte per byte.

Uso:  python3 tools/sync-monogramma.py [--check]
      --check  non modifica nulla, esce con 1 se index.html e' disallineato
"""
import re, sys, pathlib

SVG  = pathlib.Path('assets/brand/monogramma-light.svg')
HTML = pathlib.Path('index.html')

sorgente = SVG.read_text(encoding='utf-8')
m = re.search(r'<path\b[^>]*\sd="([^"]+)"', sorgente)
if not m:
    sys.exit(f'ERRORE: nessun <path d="..."> in {SVG}')
d = m.group(1)

html = HTML.read_text(encoding='utf-8')
pattern = re.compile(r'(<path id="rf-path"[^>]*\sd=")([^"]*)(")')
trovato = pattern.search(html)
if not trovato:
    sys.exit('ERRORE: <path id="rf-path" ... d="..."> non trovato in index.html')

if '--check' in sys.argv:
    ok = trovato.group(2) == d
    print('allineato' if ok else 'DISALLINEATO: rilanciare senza --check')
    sys.exit(0 if ok else 1)

HTML.write_text(pattern.sub(lambda mm: mm.group(1) + d + mm.group(3), html, count=1),
                encoding='utf-8')
print(f'tracciato sincronizzato: {len(d)} caratteri da {SVG}')
