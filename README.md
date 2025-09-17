# Bizscribe

Bizscribe is a **map-based discovery platform** that helps small businesses get visibility.  
Businesses can sign up, create a profile, and optionally host a micro-site.  
Users can explore nearby businesses through an interactive map and business listings.

---

## 📌 Features

### Frontend (React + Vite + TailwindCSS)
- Interactive **map** (Leaflet + Mapbox).
- Pages:
  - **Home** – list & search for businesses.
  - **MapPage** – browse via map view.
- Authentication with `AuthContext` (`Login`, `Register`).
- Business components (`BusinessCard`, `BusinessList`, `AddBusinessModal`, `MiniMap`).
- Utility helpers (`apiClient.js`, `geocode.js`, `mapboxTiles.js`, etc.).

### Backend (FastAPI + SQLAlchemy)
- **Authentication & Security**
  - JWT access + refresh tokens.
  - Role-based access control: `ADMIN`, `BUSINESS`, `USER`.
  - Password hashing with **bcrypt** (via Passlib).
- **Business Management**
  - CRUD endpoints for businesses (`/api/businesses`).
- **User Management**
  - Register, login, refresh tokens, and `/me` endpoint.
  - User roles, memberships, reviews, favorites, check-ins.
- **Database**
  - Default: SQLite (`Bizcribe.db`).
  - Configurable via `DATABASE_URL` (Postgres/MySQL supported).
- **CORS** pre-configured for local Vite development.
- **Health check** at `/health`.

### Extras
- `ai.py`: Demo integration with a local **LLaMA** AI service.
- `test.py`: Placeholder for backend tests.

---

## 🗂 Project Structure

```plaintext
backend/
  app/
    main.py           # FastAPI entrypoint
    auth.py           # Auth dependencies (get_current_user, role checks)
    security.py       # Password hashing & JWT helpers
    crud.py           # Business CRUD
    crud_user.py      # User CRUD
    models.py         # Business model
    models_user.py    # User + memberships, reviews, favorites, check-ins
    schemas.py        # Business schemas
    schemas_auth.py   # Auth schemas
    routers/
      auth.py         # /api/auth routes
      businesses.py   # /api/businesses routes
    database.py       # DB session + config
    ai.py             # Demo LLaMA integration
  requirements.txt

frontend/
  src/
    auth/             # Login, Register, AuthContext
    pages/            # Home, MapPage
    utils/            # API + map helpers
    App.jsx
    main.jsx
  package.json
  vite.config.js



## Local Setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- Git

### Backend
```powershell
cd Bizscribe\backend
python -m venv .venv
.\.venv\Scripts\Activate
pip install --upgrade pip
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Frontend (in a new terminal if backend stays running)
cd Bizscribe\frontend
npm install
npm run dev
