# BlemMap

> *Find the fires nobody is putting out.*

BlemMap is a problem intelligence platform where real-world problems are scraped from the internet, validated and converged by AI, and displayed on a two-axis matrix — so that Prospectors can discover, claim, and solve them.

---

## The Problem BlemMap Solves

Great solutions start with real problems. But finding validated, structured problems is hard — Reddit is noisy, feedback tools are private, and most developers still rely on intuition. BlemMap fixes this by turning scattered human frustration into structured, discoverable intelligence.

---

## How It Works

```
Reddit API scrapes real complaints
→ AI validates and converges similar problems
→ Problems appear on a two-axis matrix
→ Prospectors discover, claim, and solve them
→ Solutions are posted back to the platform
```

---

## The Matrix

Problems are plotted on two axes:

| | Has Solution | No Solution |
|---|---|---|
| **High Pain** | Painful but Solved | 🔥 Urgent Gap |
| **Low Pain** | Saturated | 💡 Hidden Gem |

Each dot is sized by pain score and colored by status — Amber for unclaimed, Grey for claimed, Green for solved.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML + CSS + JavaScript |
| Backend | Node.js + Express |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Real-time | Supabase Realtime |
| AI | Gemini API |
| Scraping | Reddit API + Snoowrap |
| Scheduling | Vercel Cron Jobs |
| Deployment | Vercel |

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/ghkenshee/blemap.git
cd blemap
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

```bash
cp .env .env.local
# Fill in your credentials in .env.local
```

### 4. Run in development

```bash
npm run dev
```

### 5. Run tests

```bash
npm test
```

---

## Project Structure

```
blemmap/
├── frontend/         # HTML, CSS, JavaScript UI
├── backend/
│   ├── routes/       # Express route definitions
│   ├── controllers/  # Business logic per route
│   ├── models/       # Data structures and constants
│   └── middleware/   # Auth and error handling
├── ai/               # Gemini API — validator, convergence, scorer
├── scraper/          # Reddit scraper and scheduler
├── config/           # Supabase, Gemini, Reddit credentials
├── tests/            # Unit, integration, and E2E tests
└── docs/             # Documentation and wireframes
```

---

## Development Approach

BlemMap follows a **plan-driven iterative approach** — designing thoroughly before building, then refining through cycles.

| Iteration | Focus |
|---|---|
| 1 | Core CRUD — submit, store, display cases |
| 2 | AI validation and convergence layer |
| 3 | Reddit scraping pipeline |
| 4 | Matrix UI and gap scoring |
| 5 | Solutions layer |
| 6 | PWA deployment on Vercel |

---

## Team

| Name | Role |
|---|---|
| Dicdican | CEO |
| Sheikh | CTO |
| Merin | CFO |

---