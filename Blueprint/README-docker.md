# TalentX (Docker)

This folder contains a Docker Compose setup for the `talentx` app.

## Start
From this folder:
```bash
docker compose up --build
```

## URLs
- Web (Next.js): `http://localhost:3002`
- API: `http://localhost:8082`

MongoDB runs internally on the Docker network.

## Notes
- The Next.js API proxy rewrite uses `BACKEND_URL=http://backend:8081` (set in `docker-compose.yml`).
- If AI features are blocked due to missing `OPENAI_API_KEY`, the backend will fall back where possible, but some AI-based generation may be limited.

