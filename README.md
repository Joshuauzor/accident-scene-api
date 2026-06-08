# Accident Scene API

NestJS API for multi-tenant incident reports.

## Run locally

```bash
npm install
npm run migrate:run
npm run seed:run
npm run start:dev
```

Base URL: `http://localhost:3000/api/v1`

## Main routes

- `POST /auth/register` — `{ email, tenant_slug, password, confirm_password }`
- `POST /auth/login` — `{ email, password }`
- `GET /tenants/:slug`
- `POST /tenants` — admin
- `GET /tenants` — admin
- `POST /reports` — step 1: `{ first_name, last_name, location }`
- `PATCH /reports/:id/step-2` — `{ intervention_type }`
- `GET /reports`, `GET /reports/:id`
