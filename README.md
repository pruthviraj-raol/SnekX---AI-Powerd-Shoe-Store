# SnekX - AI Powered Shoe Store

SnekX is a MERN ecommerce app with a Vite React frontend, an Express backend, MongoDB Atlas persistence, and a Python Flask AI service for chatbot and outfit recommendations.

## Project Structure

- `src/` - Vite React frontend.
- `backend/` - Node.js and Express API.
- `ai-service/` - Python Flask AI service.
- `public/` - frontend static assets.

## Local Development

1. Install frontend dependencies with `npm install`.
2. Install backend dependencies with `npm --prefix backend install`.
3. Install AI service dependencies with `pip install -r ai-service/requirements.txt`.
4. Copy `.env.example`, `backend/.env.example`, and `ai-service/.env.example` to local `.env` files.
5. Replace placeholders with local or production service values.
6. Start frontend and backend together with `npm run dev:full`.

## Environment Variables

- Frontend uses `VITE_API_URL` for the deployed backend and `VITE_API_PROXY_TARGET` only for local Vite proxying.
- Backend requires `MONGODB_URI`, `JWT_SECRET`, `CLIENT_URL`, and `AI_SERVICE_URL`.
- AI service uses `PORT`, `MAX_UPLOAD_MB`, and `AI_SERVICE_CORS_ORIGINS`.

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for Vercel frontend, Render backend, and Render AI service instructions.

## Stack

- Vite + React + TypeScript
- shadcn-ui
- Tailwind CSS
- Node.js + Express
- MongoDB Atlas
- Flask + PyTorch/Transformers
