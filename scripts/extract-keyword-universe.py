from __future__ import annotations
import csv, re
from pathlib import Path

DIR = Path(__file__).resolve().parents[2] / 'keywords'

KEEP = re.compile(
    r'(ai email|email assistant|email ai|gmail assistant|inbox assistant|'
    r'email triage|triage email|gmail triage|'
    r'fyxer|ai.?emaily|cora email|shortwave|superhuman|'
    r'organize (gmail|email|inbox)|inbox zero|email overload|'
    r'gmail (filter|label|unsubscribe|priority)|'
    r'subject line|email signature|'
    r'daily brief|voice.?match|draft reply|ai draft|'
    r'best ai email|ai email for gmail|email productivity)',
    re.I,
)
DROP = re.compile(
    r'\b(outlook|hotmail|yahoo|office ?365|exchange|salesforce|hubspot|'
    r'mailchimp|wordpress|android|iphone|apk|login|sign ?in|password|'
    r'nfl|nba|mock draft|barcode|calculator|mortgage|gmail app|'
    r'delete gmail|create gmail|recover)\b',
    re.I,
)

def num(x):
    if x is None: return None
    s = str(x).strip().replace(',','').replace('$','').strip(chr(34))
    if s in ('','-','N/A','n/a'): return None
    try: return float(s)
    except ValueError: return None

def cell(row, *names):
    for name in names:
        if name in row and row[name]:
            return str(row[name]).strip().strip(chr(34))
    return ''

merged = {}

def upsert(kw, vol, kd, cpc, src):
    if not kw: return
    rec = {'kw': kw, 'vol': vol or 0, 'kd': kd, 'cpc': cpc, 'src': src}
    prev = merged.get(kw.lower())
    if not prev or rec['vol'] > prev['vol']:
        merged[kw.lower()] = rec

print('DIR', DIR, 'exists', DIR.exists())
for p in DIR.glob('google_us*.csv'):
    with p.open(encoding='utf-16', newline='') as fh:
        for row in csv.DictReader(fh, delimiter='\t'):
            kw = cell(row, 'Keyword')
            if not kw or DROP.search(kw) or not KEEP.search(kw):
                continue
            upsert(kw, num(cell(row,'Volume')), num(cell(row,'Difficulty')), num(cell(row,'CPC')), 'google_us')

for p in DIR.glob('fyxer.com*.csv'):
    with p.open(encoding='utf-16', newline='') as fh:
        for row in csv.DictReader(fh, delimiter='\t'):
            kw = cell(row, 'Keyword')
            if not kw or DROP.search(kw): continue
            if kw.lower() in merged: continue
            if KEEP.search(kw) or 'fyxer' in kw.lower() or 'alternative' in kw.lower():
                upsert(kw, num(cell(row,'Volume')), None, None, 'fyxer')

for p in DIR.glob('aiemaily.com*.csv'):
    with p.open(encoding='utf-16', newline='') as fh:
        for row in csv.DictReader(fh, delimiter='\t'):
            kw = cell(row, 'Keyword')
            if not kw: continue
            if kw.lower() in merged: continue
            upsert(kw, num(cell(row,'Volume')), num(cell(row,'KD')), num(cell(row,'CPC')), 'aiemaily')

rows = sorted(merged.values(), key=lambda x: (-(x['vol'] or 0), x['kd'] if x['kd'] is not None else 99))
print('kept', len(rows))
for rec in rows[:120]:
    kd = '-' if rec['kd'] is None else str(int(rec['kd']))
    cpc = '-' if rec['cpc'] is None else ('%.2f' % rec['cpc'])
    print('%7.0f  kd=%4s  cpc=%6s  %-8s  %s' % (rec['vol'], kd, cpc, rec['src'], rec['kw']))
