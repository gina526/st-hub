# Gina's S&T Hub

A single-file personal recruiting hub for US Sales & Trading, targeting Summer 2028 internships.

## What this is
`index.html` is a self-contained React app (no build step, no bundler). Everything lives in one file. It uses React 18 via CDN and Babel standalone for JSX compilation in the browser.

## Owner context
- Gina Ou, UChicago Class of 2029 (rising sophomore), F-1 student
- Target: US S&T sales roles (NY), Summer 2028
- PAIR investment club member

## Stack
- Single HTML file: `index.html`
- React 18 + ReactDOM via unpkg CDN
- Babel standalone (JSX compiled in browser)
- No npm, no node_modules, no build step
- Styles: inline CSS-in-JS only (the `C` color constants object at the top)

## Sections
| Tab | Component | What it does |
|-----|-----------|--------------|
| Today | `TodaySection` | Live market brief via Claude API + web search |
| Learn | `LearnSection` | S&T tutor chatbot (Claude API) |
| Product Explorer | `ProductsSection` | Rates/Equities/FX/Credit explainer + desk quiz |
| Sources | `SourcesSection` | Curated reading/podcast list with links |
| Mental Model | `ModelSection` | Market hierarchy, risk-on/off framework |
| Macro | `MacroSection` | Economic cycle, data calendar, Fed, yield curve |
| Asset Classes | `AssetsSection` | Equities, Fixed Income, FX, Alts |
| Glossary | `GlossarySection` | Searchable 30+ term glossary |
| Market History | `NarrativeSection` | 2020–2026 timeline, interview narrative |
| Interview Prep | `InterviewSection` | Q&A bank, coffee chat framework |
| Your Edge | `NicheSection` | Gina-specific differentiators, target programs |

## Color system
All colors are in the `C` constant object near the top of the `<script>` tag. Edit there to change the theme.

## Claude API
- Key stored in `localStorage` under `ant_key`
- `callClaude()` function handles all API calls
- `TodaySection` uses `web_search` tool for live market data
- Model: `claude-sonnet-4-6`

## How to deploy changes
After editing `index.html`:
```bash
cd ~/Desktop/st-hub
git add index.html
git commit -m "describe change"
git push
```
Netlify auto-deploys in ~30 seconds. No build step needed.

## GitHub repo
https://github.com/gina526/st-hub (private)

## Live URL
https://thriving-custard-e8f1cf.netlify.app

## Key rules when editing
- Do NOT add npm, package.json, or a build system — the whole point is zero tooling
- Do NOT split into multiple files — single file only
- Keep all styles inline (no external CSS files)
- The file must remain self-contained and openable by just double-clicking
