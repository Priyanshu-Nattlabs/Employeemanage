# Job Blueprint V2

Full rebuild of the Job Blueprint subsystem using:

- Backend: NestJS + TypeScript + MongoDB (Mongoose)
- Frontend: Next.js + TypeScript
- AI: OpenAI SDK with strict JSON parsing fallback

## Structure

- `apps/api` - NestJS backend APIs
- `apps/web` - Next.js frontend

## Features Ported

- Blueprint discovery and mappings
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

## Environment

Create `apps/api/.env`:

```env
PORT=8081
MONGODB_URI=mongodb://localhost:27017/job_blueprint_v2
OPENAI_API_KEY=
```

