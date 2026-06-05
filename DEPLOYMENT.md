# SehatSaathi Deployment

## What this repo now supports

- Backend API container
- Patient frontend container
- Ops frontend container
- Single `docker-compose.yml` for local production-style bring-up

## Required production environment

Set these in `./backend/.env` before any real deployment:

- `NODE_ENV=production`
- `PORT=8080`
- `DB_PROVIDER=postgres`
- `DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<db>?sslmode=require`
- `JWT_SECRET=<strong-random-secret>`
- `CORS_ORIGINS=https://patient.yourdomain.com,https://ops.yourdomain.com`

Optional but recommended:

- `DB_PATH=/app/data/health.db` (only for local sqlite development)
- `UPLOAD_DIR=/app/data/uploads`
- `JWT_EXPIRES_IN=7d`
- `PASSWORD_RESET_OUTBOX_PATH=/app/data/outbox/password_reset_requests.log`
- `ALERT_WEBHOOK_URL=https://your-alert-endpoint`
- `ALERT_WEBHOOK_AUTH=<optional-bearer-token>`
- `ALERT_COOLDOWN_SECONDS=120`
- `UPTIME_HEARTBEAT_SECONDS=60`

If ML triage is enabled, also set:

- `TRIAGE_MODEL_ENABLED=true`
- `TRIAGE_MODEL_PYTHON=python3`
- `TRIAGE_MODEL_SCRIPT=/app/ml/predict_triage.py`
- `TRIAGE_MODEL_FILE=/app/ml/artifacts/triage_model.joblib`
- `TRIAGE_MODEL_META_FILE=/app/ml/artifacts/model_metadata.json`

## Local production-style start

From the repo root:

```bash
docker compose up --build
```

## Service URLs

- Backend: `http://localhost:8080`
- Patient app: `http://localhost:5173`
- Ops app: `http://localhost:5174`

## Health checks

- Backend: `GET /api/health`
- Frontends: `GET /healthz`

## Production deployment notes

This code can now be containerized cleanly, but hospital deployment still requires external operations work:

1. Put the three services behind HTTPS with real domains.
2. Use managed PostgreSQL for pilot and production.
3. Set monitoring and alerting outside the app.
   This build can push alert payloads to `ALERT_WEBHOOK_URL` for 5xx and heartbeat DB failures.
4. Run a restore test before pilot.
5. Disable any demo credentials after first deployment.
6. Wire the password reset outbox into real email/SMS delivery or a helpdesk process before hospital use.

## Backup and restore operations (SQLite)

Run ad-hoc backup:

```bash
cd backend
npm run backup:run
```

Run restore verification (uses latest backup by default):

```bash
cd backend
npm run backup:restore-test
```

Daily backup schedule example (macOS `launchd` or cron):

```bash
cd backend
BACKUP_RETENTION_DAYS=14 npm run backup:run
```

Recommended: schedule this once every day and run `backup:restore-test` at least once per week.

## Current default demo admin

- Email: `admin@sehatsaathi.local`
- Password: `Admin@12345`

Change or disable this account before a real hospital trial.
