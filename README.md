# ai-sandbox-template-portal

**Archetype:** Simple portal (Next.js 15 + App Router).

This is one of the starter templates fetched by the [ASAI toolbox AI Sandbox](https://github.com/upheadsno/asai-flexis-frontend) wizard. Pick the **Simple portal** template when creating a new sandbox project to scaffold a minimal Next.js app that deploys via `docker-compose` to the shared sandbox host.

## Contents

- `web/` — Next.js 15 (App Router) app, exposed on port 3000
- `docker-compose.yml` — single `web` service consuming `ghcr.io/<repo>/web:latest`
- `.github/workflows/build-images.yml` — pushes `web` image to GHCR on every `main` push

## Local dev

```sh
pnpm install && pnpm dev
```

## Deploy

Push to `main`. The build workflow pushes the image to GHCR; the toolbox deploy step then runs `docker compose pull && up -d --no-build` on the sandbox host.
