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
cd blemap
npm install
```

### 3. Set up environment variables

Create `blemap/.env` using the variables described in the [New Programmer Setup Guide](#new-programmer-setup-guide).

### 4. Run in development

```bash
npm run dev
```

### 5. Run tests

```bash
npm test
```

---

## New Programmer Setup Guide

The current working application has two servers. The Node server handles the API and the Python server generates text embeddings. Start both servers in separate terminals.

### Prerequisites

- Node.js 18 or newer
- Python 3.10 or newer
- Git
- A Supabase project with the required tables

### 1. Install the Node dependencies

Run this from the repository's `blemap` directory, not from the repository root:

```bash
cd blemap
npm install
```

The backend starts on `http://localhost:4000`.

### 2. Configure the backend environment

Create `blemap/.env` with the values used by the database clients:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Keep `.env` private. The service-role key bypasses Supabase Row Level Security and must only be used by the backend. Do not put it in frontend files or commit it to Git.

### 3. Set up the embedding model

Create and activate a Python virtual environment:

```powershell
cd blemap/backend/services
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install fastapi uvicorn sentence-transformers torch
```

Start the embedding API and leave this terminal running:

```powershell
python -m uvicorn embedding_service:app --host 0.0.0.0 --port 8000
```

The first start downloads `sentence-transformers/all-MiniLM-L6-v2`. This is expected and may take a while. The Node backend expects the endpoint `POST http://localhost:8000/embed` and sends JSON in this format:

```json
{"text": "A user's problem description"}
```

The embedding service returns a JSON array of numbers. If port `8000` is unavailable, update the URL in `backend/services/embeddingService.js` and use the same URL consistently.

### 4. Start the Node backend

Open a second terminal:

```powershell
cd blemap
npm run dev
```

The API is now available at `http://localhost:4000`. For a simple submission, the frontend calls `POST /api/submit` with a JSON body containing `text`.

### 5. Serve the frontend

The frontend is plain HTML and JavaScript. From the `blemap` directory, use a third terminal:

```powershell
python -m http.server 5500 --directory frontend
```

Open `http://localhost:5500/input.html` in a browser. The frontend sends requests to the backend on port `4000`, so the backend and embedding server must both be running first.

### 6. Set up Supabase

Run the SQL files in the Supabase SQL Editor as appropriate for the current schema:

- `database/roles.sql` and the profile setup for roles and users
- `database/precase.sql` for scraped or preprocessed source records
- `database/policy.sql` for Row Level Security policies on cases

Check the repository files before running migrations because the schema is still evolving. The backend expects tables such as `cases`, `precase`, and `submissions`, plus the columns used by the repositories.

### How a submission is processed

1. A user enters free-form text in `frontend/input.js`.
2. The browser sends `{ "text": "..." }` to `POST /api/submit`.
3. `backend/services/embeddingService.js` forwards the text to FastAPI.
4. `embedding_service.py` converts the text into a numerical vector using MiniLM.
5. `backend/services/caseService.js` compares that vector with stored vectors using cosine similarity.
6. `backend/services/submissionService.js` uses the `0.75` threshold: a sufficiently similar result is attached to an existing case; otherwise a new case is created.

The original text and the embedding are different things: the original text is readable and displayed to users, while the embedding is used for semantic similarity searches.

### Troubleshooting checklist

| Symptom | Likely cause | Check |
|---|---|---|
| `ECONNREFUSED` for port `8000` | The Python embedding server is not running | Start Uvicorn in the backend services directory |
| `Embedding service failed` | FastAPI returned an error or the model failed to load | Open `http://localhost:8000/docs` and inspect the Python terminal |
| Backend exits on startup | Missing or invalid Supabase environment variables | Check `blemap/.env` and restart Node |
| Browser reports a network or CORS error | Backend is stopped or the URL/port is wrong | Confirm `http://localhost:4000` and the URL in `frontend/input.js` |
| Every submission becomes a new case | No stored embeddings, invalid embeddings, or similarity below `0.75` | Check the precase data and backend similarity logs |
| PowerShell refuses activation | Script execution policy blocks the virtual environment | Run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned` in that terminal |

### Useful commands

```powershell
# Run the backend without file watching
npm start

# Run the test suite
npm test

# Check the embedding service's interactive API documentation
Start-Process http://localhost:8000/docs
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