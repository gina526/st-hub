#!/usr/bin/env node
// Daily market brief generator — runs via GitHub Actions, writes public/brief.json
// Uses Node 20 built-in fetch (no npm install needed)

const fs = require('fs');

const FINNHUB  = process.env.FINNHUB_KEY        || '';
const FRED     = process.env.FRED_KEY            || '';
const AV       = process.env.ALPHA_VANTAGE_KEY   || '';
const ANTHROPIC = process.env.ANTHROPIC_KEY      || '';

async function safeGet(url, label) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch (e) {
    console.warn(`[${label}] failed: ${e.message}`);
    return null;
  }
}

function fmt(n, decimals = 2) {
  if (n == null || isNaN(Number(n))) return 'N/A';
  return Number(n).toFixed(decimals);
}

function fredLatestTwo(data) {
  if (!data?.observations) return [null, null];
  const valid = data.observations.filter(o => o.value !== '.');
  return [valid[0] || null, valid[1] || null];
}

async function main() {
  const today = new Date().toISOString().split('T')[0];
  console.log(`Generating brief for ${today}…`);

  // ── Fetch all sources in parallel ──────────────────────────────────────────
  const [gspcRaw, spyRaw, newsRaw, t10Raw, t2Raw, wtiRaw, fxRaw, vixRaw] = await Promise.all([
    safeGet(`https://finnhub.io/api/v1/quote?symbol=%5EGSPC&token=${FINNHUB}`, '^GSPC'),
    safeGet(`https://finnhub.io/api/v1/quote?symbol=SPY&token=${FINNHUB}`, 'SPY'),
    safeGet(`https://finnhub.io/api/v1/news?category=general&token=${FINNHUB}`, 'News'),
    safeGet(`https://api.stlouisfed.org/fred/series/observations?series_id=DGS10&api_key=${FRED}&sort_order=desc&limit=2&file_type=json`, '10Y'),
    safeGet(`https://api.stlouisfed.org/fred/series/observations?series_id=DGS2&api_key=${FRED}&sort_order=desc&limit=2&file_type=json`, '2Y'),
    safeGet(`https://www.alphavantage.co/query?function=WTI&interval=daily&apikey=${AV}`, 'WTI'),
    safeGet(`https://www.alphavantage.co/query?function=FX_DAILY&from_symbol=EUR&to_symbol=USD&apikey=${AV}`, 'EUR/USD'),
    safeGet(`https://api.stlouisfed.org/fred/series/observations?series_id=VIXCLS&api_key=${FRED}&sort_order=desc&limit=2&file_type=json`, 'VIXCLS'),
  ]);

  // ── Parse S&P 500 (^GSPC preferred, SPY*10 fallback) ──────────────────────
  let sp500 = null;
  if (gspcRaw?.c && gspcRaw.c > 1000) {
    sp500 = { label: 'S&P 500', value: fmt(gspcRaw.c, 0), change: fmt(gspcRaw.d, 0), changePct: fmt(gspcRaw.dp), up: (gspcRaw.d ?? 0) >= 0 };
  } else if (spyRaw?.c) {
    sp500 = { label: 'S&P 500 (~)', value: fmt(spyRaw.c * 10, 0), change: fmt(spyRaw.d * 10, 0), changePct: fmt(spyRaw.dp), up: (spyRaw.d ?? 0) >= 0 };
  }

  // ── Parse VIX from FRED VIXCLS ────────────────────────────────────────────
  const [vixCur, vixPrev] = fredLatestTwo(vixRaw);
  const vix = vixCur ? {
    value: fmt(parseFloat(vixCur.value)),
    change: vixPrev ? fmt(parseFloat(vixCur.value) - parseFloat(vixPrev.value)) : 'N/A',
    up: vixPrev ? parseFloat(vixCur.value) >= parseFloat(vixPrev.value) : false,
  } : null;

  // ── Parse FRED yields ──────────────────────────────────────────────────────
  const [t10cur, t10prev] = fredLatestTwo(t10Raw);
  const [t2cur,  t2prev]  = fredLatestTwo(t2Raw);

  const t10 = t10cur ? {
    value: fmt(parseFloat(t10cur.value)),
    changeBps: t10prev ? fmt((parseFloat(t10cur.value) - parseFloat(t10prev.value)) * 100, 1) : 'N/A',
    up: t10prev ? parseFloat(t10cur.value) >= parseFloat(t10prev.value) : true,
  } : null;

  const t2 = t2cur ? {
    value: fmt(parseFloat(t2cur.value)),
    changeBps: t2prev ? fmt((parseFloat(t2cur.value) - parseFloat(t2prev.value)) * 100, 1) : 'N/A',
    up: t2prev ? parseFloat(t2cur.value) >= parseFloat(t2prev.value) : true,
  } : null;

  // ── Parse WTI ──────────────────────────────────────────────────────────────
  const wtiSeries = wtiRaw?.data;
  const wti = wtiSeries?.length >= 2 ? {
    value: fmt(parseFloat(wtiSeries[0].value)),
    change: fmt(parseFloat(wtiSeries[0].value) - parseFloat(wtiSeries[1].value)),
    up: parseFloat(wtiSeries[0].value) >= parseFloat(wtiSeries[1].value),
  } : null;

  // ── Parse EUR/USD → DXY proxy ──────────────────────────────────────────────
  const fxSeries = fxRaw?.['Time Series FX (Daily)'];
  let dxy = null;
  if (fxSeries) {
    const dates = Object.keys(fxSeries).sort().reverse();
    if (dates.length >= 2) {
      const cur  = parseFloat(fxSeries[dates[0]]['4. close']);
      const prev = parseFloat(fxSeries[dates[1]]['4. close']);
      dxy = {
        eurusd: fmt(cur, 4),
        eurusdChange: fmt(cur - prev, 4),
        up: cur < prev,  // DXY moves inverse to EUR/USD
      };
    }
  }

  // ── Parse news headlines ───────────────────────────────────────────────────
  const headlines = Array.isArray(newsRaw)
    ? newsRaw.slice(0, 10).map(n => `- ${n.headline} (${n.source})`).join('\n')
    : '(no headlines available)';

  // ── Build prompt ───────────────────────────────────────────────────────────
  const rawData = [
    `Date: ${today}`,
    '',
    'LIVE MARKET DATA:',
    `S&P 500: ${sp500 ? `${sp500.value}, day change: ${sp500.change} (${sp500.changePct}%)` : 'N/A'}`,
    `VIX (FRED VIXCLS): ${vix ? `${vix.value}, day change: ${vix.change}` : 'N/A'}`,
    `10Y Treasury (FRED): ${t10?.value ?? 'N/A'}%, day change: ${t10?.changeBps ?? 'N/A'} bps`,
    `2Y Treasury (FRED): ${t2?.value ?? 'N/A'}%, day change: ${t2?.changeBps ?? 'N/A'} bps`,
    `WTI Crude: $${wti?.value ?? 'N/A'}, day change: $${wti?.change ?? 'N/A'}`,
    `EUR/USD: ${dxy?.eurusd ?? 'N/A'} (DXY moves inverse — EUR/USD up = DXY down), day change: ${dxy?.eurusdChange ?? 'N/A'}`,
    '',
    'TOP NEWS HEADLINES (Finnhub):',
    headlines,
  ].join('\n');

  const prompt = `${rawData}

Using the real market data above, return ONLY a valid JSON object — no markdown, no text before or after the JSON.

Required structure:
{
  "date": "${today}",
  "generated_at": "${new Date().toISOString()}",
  "market_levels": [
    {"name": "S&P 500", "value": "...", "change": "...", "up": true},
    {"name": "10Y UST", "value": "...%", "change": "... bps", "up": true},
    {"name": "2Y UST", "value": "...%", "change": "... bps", "up": true},
    {"name": "DXY", "value": "...", "change": "...", "up": false},
    {"name": "VIX", "value": "...", "change": "...", "up": false}
  ],
  "stories": [
    {"headline": "...", "source": "...", "summary": "2 sentences", "why_matters": "1 sentence on US S&T relevance", "tag": "Rates"}
  ],
  "calendar": [
    {"day": "Mon", "event": "...", "importance": "high", "note": "..."}
  ],
  "concept": {"title": "...", "one_liner": "...", "explanation": "2-3 sentences tied to today's data", "market_link": "..."},
  "narrative": "1-2 sentence macro summary tied to today's actual numbers"
}

Rules:
- market_levels: use the actual fetched values above. For DXY, estimate from EUR/USD (label it as ~DXY). All 5 items required.
- stories: exactly 3 items from the headlines above, tag each as one of: Rates, Equities, FX, Macro, Credit
- calendar: 2-3 key US economic events happening THIS week (use your knowledge of what's scheduled)
- concept: choose a concept directly illustrated by today's market data
- Output only the JSON object, nothing else`;

  // ── Call Anthropic ──────────────────────────────────────────────────────────
  console.log('Calling Anthropic API…');
  let brief;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
    const result = await r.json();
    const text = result.content.filter(b => b.type === 'text').map(b => b.text).join('');

    const start = text.indexOf('{');
    const end   = text.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('No JSON object found in response');

    brief = JSON.parse(text.slice(start, end + 1));
    console.log('Brief generated successfully.');
  } catch (e) {
    console.error('Anthropic failed:', e.message);
    // Graceful fallback — raw numbers, no AI narrative
    brief = {
      date: today,
      generated_at: new Date().toISOString(),
      market_levels: [
        { name: sp500?.label ?? 'S&P 500', value: sp500 ? sp500.value : 'N/A', change: sp500 ? `${sp500.change} (${sp500.changePct}%)` : 'N/A', up: sp500?.up ?? true },
        { name: '10Y UST',  value: t10  ? `${t10.value}%`   : 'N/A', change: t10  ? `${t10.changeBps} bps`               : 'N/A', up: t10?.up  ?? true  },
        { name: '2Y UST',   value: t2   ? `${t2.value}%`    : 'N/A', change: t2   ? `${t2.changeBps} bps`                : 'N/A', up: t2?.up   ?? true  },
        { name: '~DXY',     value: dxy  ? dxy.eurusd         : 'N/A', change: dxy  ? dxy.eurusdChange                     : 'N/A', up: dxy?.up  ?? false },
        { name: 'VIX',      value: vix  ? vix.value : 'N/A', change: vix ? vix.change : 'N/A', up: vix?.up ?? false },
      ],
      stories: [{ headline: 'Brief narrative unavailable', source: 'System', summary: `Anthropic API error: ${e.message}`, why_matters: 'Check ANTHROPIC_KEY secret.', tag: 'Macro' }],
      calendar: [],
      concept: { title: 'N/A', one_liner: '', explanation: '', market_link: '' },
      narrative: `Raw market data loaded. AI narrative failed: ${e.message}`,
    };
  }

  // ── Write output ────────────────────────────────────────────────────────────
  fs.mkdirSync('public', { recursive: true });
  fs.writeFileSync('public/brief.json', JSON.stringify(brief, null, 2));
  console.log('Written to public/brief.json');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
