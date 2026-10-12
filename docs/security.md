# PowerPulse — Security

## Authentication (users)
- `POST /api/v1/auth/login {email, password}` checks a BCrypt hash (strength 10). On success it sets the cookie **`pp_token`**, a JWT (HS256) with `sub=userId`, `role` and `exp` (default 8h, `powerpulse.security.jwt.expiry-minutes`).
- Cookie attributes: `HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` when `powerpulse.security.cookie-secure=true` (prod).
- The secret comes from `POWERPULSE_JWT_SECRET` (≥ 32 bytes). The `dev` and `test` profiles use a documented non-production value, and startup fails in other profiles if it is unset.
- `JwtCookieAuthenticationFilter` validates the cookie, loads the user (must be `active`) and populates `SecurityContext` with an `AuthenticatedUser` principal (`id, name, email, role, region`).
- `POST /api/v1/auth/logout` expires the cookie. The API is stateless (`SessionCreationPolicy.STATELESS`).
- A missing or invalid token returns **401** `ApiError` (code `UNAUTHORIZED`). Insufficient role returns **403** (code `FORBIDDEN`).

## CSRF
Cookie auth is used, so CSRF is **enabled**:
- `CookieCsrfTokenRepository.withHttpOnlyFalse()` sets the `XSRF-TOKEN` cookie. The SPA echoes it in the `X-XSRF-TOKEN` header on POST/PATCH/PUT/DELETE (`apiClient.ts` does this automatically).
- A filter forces the token to load on every request so the cookie is always present after the first GET. The SPA calls `GET /api/v1/auth/csrf` at boot.
- Exempt endpoints: `POST /api/v1/auth/login`, which still requires the JSON body and a SameSite cookie, and `POST /api/v1/readings`, which uses device-key auth and no cookies.

## Device authentication (sensor ingestion)
`POST /api/v1/readings` uses its own filter chain (`@Order(1)`, `securityMatcher("/api/v1/readings")`):
- Header `X-Device-Key: <key>` is SHA-256 hashed and looked up in `devices` (`active=true`). Otherwise the response is 401.
- In the dev profile, a demo device is seeded with key `dev-device-key-change-me` (documented as dev-only).

## CORS
Explicit allow-list from `powerpulse.cors.allowed-origins` (env `CORS_ORIGIN`, default `http://localhost:5173`), with `allowCredentials=true`. In dev the Vite proxy makes requests same-origin anyway.

## Role permission matrix
| Capability | ADMIN | ENGINEER | OPERATOR | TECHNICIAN |
|---|:-:|:-:|:-:|:-:|
| View dashboard, grid, transformers, readings, alerts, fault history | ✓ | ✓ | ✓ | ✓ |
| Create / edit transformers | ✓ | ✓ | – | – |
| Acknowledge alert, set IN_PROGRESS, assign alert | ✓ | ✓ | ✓ | – |
| Resolve alert | ✓ | ✓ | – | – |
| Create maintenance task (incl. from alert) | ✓ | ✓ | – | – |
| Assign technician, change priority / due date, cancel task | ✓ | ✓ | – | – |
| View maintenance tasks | all | all | all | **own assigned only** |
| Record manual meter readings (`POST /transformers/{id}/readings`) | ✓ | ✓ | – | ✓ |
| Update task progress: start, findings, work notes, parts, complete | ✓ | ✓ | – | **own assigned only** |
| Reports and CSV export | ✓ | ✓ | ✓ | – |
| Read settings | ✓ | ✓ | – | – |
| Update settings / thresholds | ✓ | – | – | – |
| Simulation status | ✓ | ✓ | ✓ | ✓ |
| Simulation control (start/pause/reset/scenarios) | ✓ | ✓ | – | – |
| User administration, audit logs | ✓ | – | – | – |
| Notifications | own only | own only | own only | own only |
| `POST /readings` | device key only | | | |
| `GET /public/network-preview` (sanitized: code, name, location, grid position, status, health, load, connectedTo) | public | | | |

Enforcement:
- URL rules in `SecurityConfig` for coarse checks.
- `@PreAuthorize` on controller methods for role checks.
- **Service-level checks** for ownership (technician task scoping, notification recipient). A frontend `RoleGate` only hides UI.

## Dev seed accounts (profile `dev` only, never created in other profiles)
| Email | Password | Role |
|---|---|---|
| admin@powerpulse.local | PowerPulse!Admin1 | ADMIN |
| engineer@powerpulse.local | PowerPulse!Eng1 | ENGINEER |
| operator@powerpulse.local | PowerPulse!Op1 | OPERATOR |
| tech@powerpulse.local | PowerPulse!Tech1 | TECHNICIAN |
| tech2@powerpulse.local | PowerPulse!Tech2 | TECHNICIAN |
| demo@powerpulse.local | PowerPulse!Demo1 | ENGINEER (used by `/demo` so visitors can trigger scenarios) |

## Secrets and logging
- No secrets in the frontend. `VITE_*` variables hold only the API base URL.
- Passwords, hashes, JWTs, cookies and device keys are never logged, and `passwordHash` is never serialized.
- Error responses never include stack traces (`server.error.include-stacktrace=never`).
