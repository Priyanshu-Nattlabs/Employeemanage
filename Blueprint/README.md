# TalentX

Full rebuild of the TalentX subsystem using:

- Backend: NestJS + TypeScript + MongoDB (Mongoose)
- Frontend: Next.js + TypeScript
- AI: OpenAI SDK with strict JSON parsing fallback

## Structure

- `apps/api` - NestJS backend APIs
- `apps/web` - Next.js frontend

## Features Ported

- TalentX discovery and mappings
- Role details and Gantt generation
- Skill topics generation
- Skill test lifecycle (start, answer, submit, result)
- Role preparation and analytics

## Quick Start

```bash
npm install
npm run dev:api
npm run dev:web
```

## Docker (Full Stack)

Run the full TalentX stack (MongoDB + API + Web) with one command:

```bash
docker compose up --build -d
```

Services:

- Web: `http://localhost:3002`
- API: `http://localhost:8081`
- MongoDB: `mongodb://localhost:27017`

Stop stack:

```bash
docker compose down
```

Stop + remove DB volume:

```bash
docker compose down -v
```

## Environment

Create `apps/api/.env`:

```env
PORT=8081
MONGODB_URI=mongodb://localhost:27017/job_blueprint_v2
OPENAI_API_KEY=
```

