# PowerPulse

**See the fault before the failure.**

PowerPulse is a transformer monitoring, fault-detection and maintenance management platform:
a React + Three.js frontend, a Spring Boot 3 (Java 25) API, and MongoDB.

> Work in progress. See `docs/` for the architecture, API contracts, data models, security model and development plan.

## Project structure

```
Powerpulse/
├── frontend/   React + TypeScript + Vite + Three.js web app
├── backend/    Spring Boot 3 (Java 25) REST API + MongoDB
├── docs/       Architecture, API contracts, data models, security
└── docker-compose.yml
```

## Running locally

Prerequisites: JDK 25, Maven 3.9+, Node 20+, MongoDB running on `localhost:27017`.

**1. Start MongoDB** (Homebrew):
```bash
brew services start mongodb-community@8.0
# or, if launchd refuses: mongod --config /opt/homebrew/etc/mongod.conf
```

**2. Start the API** (terminal 1). The `dev` profile seeds demo users, a demo sensor device, 20 transformers and 24 h of SIMULATED readings, and starts the simulator:
```bash
cd backend
mvn spring-boot:run -Dspring-boot.run.profiles=dev
```
Wait for `Dev seed: 20 transformers …` in the log. The API is on http://localhost:8080 (Swagger UI: http://localhost:8080/swagger-ui.html).

**3. Start the web app** (terminal 2, while the API is running):
```bash
cd frontend
npm install        # first time only
npm run dev
```
Open http://localhost:5173. Vite proxies `/api` to `http://localhost:8080`, so the login cookie stays same-origin and no extra config is needed. To point at a different API, set `VITE_PROXY_TARGET=http://host:port` before `npm run dev`.

**4. Sign in** with a dev-only seed account (created only under the `dev` profile):

| Email | Password | Role |
|---|---|---|
| admin@powerpulse.local | PowerPulse!Admin1 | ADMIN |
| engineer@powerpulse.local | PowerPulse!Eng1 | ENGINEER |
| operator@powerpulse.local | PowerPulse!Op1 | OPERATOR |
| tech@powerpulse.local | PowerPulse!Tech1 | TECHNICIAN |
| demo@powerpulse.local | PowerPulse!Demo1 | ENGINEER (used by `/demo`) |

Try a scenario: Dashboard → Simulation panel → choose `critical-overheating` and a transformer → Run. Within ~2 ticks (10 s each) the alert, health drop, dashboard counts, 3D grid colour and notification all update.

To reset demo data: stop the API, run `mongosh powerpulse --eval 'db.dropDatabase()'`, start it again.

**Tests:** `cd backend && mvn test` (uses the local MongoDB, databases `powerpulse_test_*`), `cd frontend && npm test`.

All sensor readings in this build are **simulated**. Fault detection is rule-based with configurable thresholds; it is not a trained model and is not real IoT telemetry.
