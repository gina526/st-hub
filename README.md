# Gina's S&T Hub

Personal recruiting hub for US Sales & Trading, targeting Summer 2028 internships.

Live: https://snt-hub.netlify.app

## Daily Brief — Setup

The daily brief auto-generates every weekday at 7am ET via GitHub Actions and commits `public/brief.json` to this repo. Netlify then deploys it, and the hub auto-loads it on page open.

### Step 1 — Get your API keys (all free)

| Key | Where to get it |
|-----|----------------|
| `FINNHUB_KEY` | [finnhub.io](https://finnhub.io) → Sign up → API key on dashboard |
| `FRED_KEY` | [fred.stlouisfed.org/docs/api/fred](https://fred.stlouisfed.org/docs/api/fred) → Request API key |
| `ALPHA_VANTAGE_KEY` | [alphavantage.co/support/#api-key](https://www.alphavantage.co/support/#api-key) → Get free key |
| `ANTHROPIC_KEY` | [console.anthropic.com/api-keys](https://console.anthropic.com/api-keys) → Create key |

### Step 2 — Add secrets to GitHub

1. Go to your repo on GitHub → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret** for each key above
3. Name them exactly: `FINNHUB_KEY`, `FRED_KEY`, `ALPHA_VANTAGE_KEY`, `ANTHROPIC_KEY`

### Step 3 — Test it

Go to **Actions** tab → **Daily Market Brief** → **Run workflow** → Run. Check the logs. If it succeeds, `public/brief.json` will be committed and Netlify will deploy it within 30 seconds.

After that, the brief auto-generates every weekday morning at 7am ET with no action required.

## Stack

Single-file React app (`index.html`). No build step. No npm. Styles are all inline CSS-in-JS.
