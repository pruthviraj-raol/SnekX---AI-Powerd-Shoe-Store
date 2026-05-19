# SnekX Production Deployment

This repository contains three deployable services:

- Frontend: Vite React app at the repository root.
- Backend: Express API in `backend/`.
- AI service: Flask service in `ai-service/`.

## Production URLs

- Frontend: `https://snek-x-ai-powerd-shoe-store.vercel.app`
- Backend: `https://snekx-backend.onrender.com`
- AI service: `https://snekx-ai-service.onrender.com`

If Render assigns a different AI service URL, update `AI_SERVICE_URL` on the backend service.

## Vercel Frontend

1. Import the GitHub repository into Vercel.
2. Set the project root to the repository root.
3. Use these build settings:
   - Install command: `npm ci`
   - Build command: `npm run build`
   - Output directory: `dist`
4. Add this environment variable:
   - `VITE_API_URL=https://snekx-backend.onrender.com`
5. Deploy.

`vercel.json` also rewrites `/api/*` and `/uploads/*` to the Render backend. This keeps relative API calls working if `VITE_API_URL` is not present, while `VITE_API_URL` remains the preferred production setting.

## Render Backend

1. Create a Render Web Service from the `backend/` folder, or apply `render.yaml` as a Blueprint.
2. Use these settings:
   - Runtime: Node
   - Build command: `npm ci`
   - Start command: `npm start`
   - Health check path: `/api/health`
3. Add these environment variables:
   - `NODE_ENV=production`
   - `MONGODB_URI=<MongoDB Atlas connection string>`
   - `JWT_SECRET=<long random secret>`
   - `JWT_EXPIRES_IN=7d`
   - `CLIENT_URL=https://snek-x-ai-powerd-shoe-store.vercel.app`
   - `AI_SERVICE_URL=<deployed AI service URL>`
   - `DEFAULT_ADMIN_EMAIL=<admin email>` optional
   - `DEFAULT_ADMIN_PASSWORD=<strong admin password>` optional
   - `DEFAULT_ADMIN_NAME=SnekX Admin` optional
4. Deploy and confirm `https://snekx-backend.onrender.com/api/health` returns success.

The backend requires `MONGODB_URI` and `JWT_SECRET`. Do not commit real values.

## Render AI Service

1. Create a Render Web Service from the `ai-service/` folder, or apply `render.yaml` as a Blueprint.
2. Use these settings:
   - Runtime: Python
   - Root directory: `ai-service`
   - Python version: `3.11`
   - Build command: `python --version && python -m pip install --upgrade pip setuptools wheel && python -m pip install -r requirements.txt`
   - Start command: `gunicorn app:app --bind 0.0.0.0:$PORT --workers 1 --timeout 180`
   - Health check path: `/health`
3. Add these environment variables:
   - `PYTHON_VERSION=3.11.9`
   - `FLASK_ENV=production`
   - `FLASK_DEBUG=false`
   - `MAX_UPLOAD_MB=10`
   - `CLIENT_URL=https://snek-x-ai-powerd-shoe-store.vercel.app`
   - `AI_SERVICE_CORS_ORIGINS=https://snek-x-ai-powerd-shoe-store.vercel.app`
4. Deploy and confirm the build logs print `Python 3.11.x` before dependency installation.
5. Confirm `/health` returns `status: ok`.

The AI service includes `ai-service/.python-version` with `3.11` so Render does not fall back to its default Python `3.14.3`. `ai-service/runtime.txt` is kept in `python-3.11.9` format for buildpack-style compatibility, but Render's supported pin is `PYTHON_VERSION` or `.python-version`.

The backend talks to the AI service through `AI_SERVICE_URL`; the frontend should continue using backend `/api/ai/*` routes.

## Local Development

1. Install frontend dependencies with `npm install`.
2. Install backend dependencies with `npm --prefix backend install`.
3. Install AI service dependencies in a Python 3.11 virtual environment with `pip install -r ai-service/requirements.txt`.
4. Copy `.env.example`, `backend/.env.example`, and `ai-service/.env.example` to local `.env` files.
5. Replace production values with local service URLs and local secrets.
6. Start the frontend and backend with `npm run dev:full`.

Keep `node_modules/`, `.venv/`, `dist/`, cache directories, uploads, and real `.env` files out of Git.
