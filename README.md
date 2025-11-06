# Bizscribe – Quickstart Guide

Welcome! This guide is for new contributors or teammates who just cloned the Bizscribe repository and want to get everything running fast. It walks through the full stack, highlights the secrets you need, and covers the common commands you’ll run day-to-day.

---

## 1. Repository Overview

```
Bizscribe/
├─ backend/              # FastAPI app (auth, business CRUD, AI demo, etc.)
├─ frontend/             # React + Vite client
├─ README.md             # Original project notes
```

### Backend Highlights
- FastAPI + SQLAlchemy, JWT auth (access + refresh tokens)
- Roles: `ADMIN`, `BUSINESS`, `USER`
- SQLite by default (`Bizscribe.db`) with optional Postgres/MySQL

### Frontend Highlights
- React 19, Vite, Tailwind layers
- Mapbox GL + Leaflet hybrid map experience
- Auth flows, business discovery pages, admin submissions review

---

## 2. Required Secret Files & Database

To boot the stack you **must** obtain a few files that are excluded from Git:

| Needed For | File | Notes |
| --- | --- | --- |
| Backend runtime | `backend/.env` | Contains `DATABASE_URL`, JWT secrets, Mapbox token fallback, etc. |
| Backend database | `backend/Bizscribe.db` (or your own DB) | Default SQLite file with seed data. Place it in `backend/` unless you configure a different database. |
| Frontend runtime | `frontend/.env` | At minimum must define `VITE_MAPBOX_TOKEN=...` so the map can load. |

> 🚫 These files are not in Git history. Ask an existing maintainer (or the repo owner) for the latest copies, or create your own `.env`/database from scratch if you’re setting up a brand new environment.

If you’re wiring Bizscribe into Postgres or another database, update `backend/.env` with a valid `DATABASE_URL`. The models auto-migrate on startup, but you’ll need to seed the data yourself.

---

## 3. System Requirements

- **Python** 3.11+
- **Node.js** 18+ (or any Node LTS that Vite supports)
- **Git** (for source control)
- **Mapbox account/token** for the frontend if you don’t have one already


---

## 4. First-Time Setup

### 4.1 Clone & Pull Secrets
```bash
git clone https://github.com/snoop775/Bizscribe.git
cd Bizscribe

# Copy in secret files you obtained separately
#   backend/.env
#   backend/Bizscribe.db        (if using SQLite)
#   frontend/.env
```

### 4.2 Backend (FastAPI)
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate   # PowerShell on Windows
pip install --upgrade pip
pip install -r requirements.txt

# Run the API
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Health check: http://localhost:8000/health  
Interactive docs: http://localhost:8000/docs


### 4.3 Frontend (React + Vite)
In a second terminal:
```Command Prompt
cd frontend
npm install
npm run dev   # starts Vite dev server, default on http://localhost:5173
```
Ensure `frontend/.env` contains a valid `VITE_MAPBOX_TOKEN`. Without it, the Mapbox layer will fail and fallback to Leaflet only.

---

## 5. Daily Dev Commands

| Purpose | Command |
| --- | --- |
| Backend (dev server) | `uvicorn app.main:app --reload --port 8000` |
| Frontend dev server | `npm run dev` |
| Frontend build | `npm run build` |
| Frontend preview (after build) | `npm run preview` |
| Formatting (React) | `npx prettier --write "src/**/*.{js,jsx,ts,tsx}"` |

---

## 6. Environment Variables Reference

### backend/.env (example)
```
DATABASE_URL=sqlite:///./Bizscribe.db
JWT_SECRET=change_me
JWT_REFRESH_SECRET=change_me_too
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
MAPBOX_TOKEN=pk.<change_me_three>
```

### frontend/.env
```
VITE_MAPBOX_TOKEN=pk.YourRealTokenHere
```

> ❗️Keep secrets out of Git. Add new sensitive entries to `.gitignore` if needed.

---

## 7. Troubleshooting

| Issue | Fix |
| --- | --- |
| **Map shows blank screen / errors** | Confirm `VITE_MAPBOX_TOKEN` is valid and the backend `/api/businesses` endpoint is reachable. Check browser dev tools console. |
| **Frontend build reintroduces old icons** | Run `npm run build` after cleaning `frontend/dist/`. Old assets only appear if referenced somewhere. |
| **Unauthorized API responses** | Make sure backend `.env` secrets match the ones in your database, especially if you imported a shared `Bizscribe.db`. |
| **Leaflet uses default blue markers** | Ensure `frontend/src/utils/mapIconSetup.js` is importing your desired marker asset (currently `pin_drop.png`). |
| **Database missing data** | If you copied a `Bizscribe.db`, verify the path and permissions. For Postgres/MySQL, run any seed scripts or manual inserts you need. |

---

## 8. Next Steps

- Explore `frontend/src/pages/Home/` to customize the main map experience.
- Dive into `backend/app/routers/` to add new API endpoints or extend business workflows.
- Update this README.md as the onboarding flow evolves.

Happy building! 🚀 If you hit issues, open an issue or reach out to the maintainers. Keeping this guide accurate is a team effort—please submit improvements as you discover smoother workflows.
