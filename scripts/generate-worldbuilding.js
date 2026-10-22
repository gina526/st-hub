#!/usr/bin/env node
// World building generator — runs after daily brief, writes public/worldbuilding.json
// Uses Node 20 built-in fetch (no npm install needed)

const fs = require('fs');

const ANTHROPIC = process.env.ANTHROPIC_KEY || '';

async function main() {
  const today = new Date().toISOString().split('T')[0];
  console.log(`Generating world building for ${today}…`);

  // ── Read today's brief ─────────────────────────────────────────────────────
  let brief;
  try {
    brief = JSON.parse(fs.readFileSync('public/brief.json', 'utf8'));
  } catch (e) {
    console.error('Could not read public/brief.json:', e.message);
    process.exit(1);
  }

  if (brief.date !== today) {
    console.log(`Brief date is ${brief.date}, today is ${today} — brief not yet updated, skipping.`);
    process.exit(0);
  }

  // ── Check if today's entry already exists ─────────────────────────────────
  let existing = [];
  try {
    existing = JSON.parse(fs.readFileSync('public/worldbuilding.json', 'utf8'));
  } catch (e) {
    // file doesn't exist yet — fine
  }

  if (existing.some(e => e.date === today)) {
    console.log(`Entry for ${today} already exists — skipping.`);
    process.exit(0);
  }

  // ── Build prompt ───────────────────────────────────────────────────────────
  const briefText = JSON.stringify(brief, null, 2);

  const prompt = `You are generating a WORLD BUILDING study set for Gina, a UChicago sophomore targeting US S&T sales (Summer 2028).

Today's market brief:
${briefText}

Return ONLY a valid JSON object — no markdown, no text before or after. Structure:
{
  "date": "${today}",
  "blocks": [
    {
      "term": "Name of the concept or instrument",
      "category": "rates|equities|fx|macro|credit|volatility|energy|fundamental",
      "bullets": ["bullet 1", "bullet 2", "bullet 3", "bullet 4", "bullet 5"],
      "so_what": "One sentence on how a trader/salesperson on an S&T desk actually uses this"
    }
  ],
  "narrative": "2-3 sentences connecting today's themes — what is the macro story, what is the market betting on? Include specific numbers."
}

REQUIREMENTS — non-negotiable:

Block count: 7-10 blocks total.

What to cover:
- Every market instrument in the brief WITH today's actual numbers: S&P 500, 10Y UST, 2Y UST, DXY/EUR/USD, VIX. Not generic definitions — incorporate today's specific values and moves.
- Key terms from the stories that require background knowledge: if the brief mentions a geopolitical event, institution, financial product, or mechanism, explain the MECHANISM, not just the name.
- 2-3 fundamental concepts needed to fully understand today's brief.

Bullet format rules:
- Note-form, not full sentences. Dense with facts and numbers from today's brief.
- Each bullet adds NEW information — never repeat the same point reworded.
- Include actual numbers (e.g. "10Y at 4.32% today, down 4bps" not "Treasury yields fell").
- 5-7 bullets per block.

"so_what" rules:
- S&T desk specific — how a trader or salesperson actually uses this knowledge day-to-day.
- Not generic ("markets move") — give the specific desk application.

Depth target: a smart person with no finance background should understand the MECHANISM after reading, not just the definition.

Category guide:
- rates: Treasury yields, Fed, duration, bonds
- equities: stocks, sectors, earnings, ETFs, equity derivatives
- fx: currencies, DXY, carry, exchange rates
- macro: economic data, geopolitics, economic cycle, policy
- credit: corporate bonds, spreads, HY/IG, CDS
- volatility: VIX, options, implied vol, hedging
- energy: oil, gas, commodities
- fundamental: basic market mechanics a non-finance person needs (bps, risk-on/off, price/yield relationship)

Output only the JSON object, nothing else.`;

  // ── Call Anthropic ──────────────────────────────────────────────────────────
  console.log('Calling Anthropic API…');
  let entry;
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
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
    const result = await r.json();
    const text = result.content.filter(b => b.type === 'text').map(b => b.text).join('');

    const start = text.indexOf('{');
    const end   = text.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('No JSON object found in response');

    entry = JSON.parse(text.slice(start, end + 1));
    if (!entry.blocks || !Array.isArray(entry.blocks)) throw new Error('Missing blocks array');
    console.log(`World building generated: ${entry.blocks.length} blocks.`);
  } catch (e) {
    console.error('Generation failed:', e.message);
    process.exit(1);
  }

  // ── Write updated worldbuilding.json ──────────────────────────────────────
  const updated = [entry, ...existing];
  fs.mkdirSync('public', { recursive: true });
  fs.writeFileSync('public/worldbuilding.json', JSON.stringify(updated, null, 2));
  console.log(`Written to public/worldbuilding.json (${updated.length} total entries).`);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
