# Dhaka Tesla Pool

> Share a seat. Split the fare. Survive Dhaka traffic.

Dhaka Tesla Pool is an MVP ride-pooling application for passengers sharing a
three-seat battery-powered vehicle. The demo follows Jashim and his Tesla
named Bullet, with Nusrat, Rafiq, and Shirin as passengers.

## Product Summary

Passengers select an ordered Dhaka route, pickup stop, drop-off stop, seat
count, and payment method. The API either matches the request to a compatible
open pool or keeps it in a requested state for a driver to accept. Drivers can
go online, review pending requests, accept passengers, and advance the pool
through its lifecycle. Each passenger sees only their own ride and fare.

The application deliberately uses predefined stops and routes instead of a
third-party map or routing service. This keeps matching deterministic and
leaves the difficult engineering problems in focus: authorization, fare
calculation, state transitions, capacity, and concurrent bookings.

## Implemented Features

- Passenger and driver registration and login with JWT authentication.
- Role-based authorization for passenger and driver workflows.
- Four seeded Dhaka routes and 26 predefined stops with latitude/longitude.
- Solo fare estimates before booking.
- Automatic matching to an existing compatible pool.
- Driver acceptance of unmatched ride requests.
- Bullet vehicle capacity enforcement; the seeded vehicle has three seats.
- Per-passenger fare calculation based on the segments they actually ride.
- Cash and simulated wallet payment methods.
- Passenger ride list, detail, status, fare, and cancellation flow.
- Driver online/offline toggle and dashboard.
- Driver view of passengers, pickup/drop-off stops, notes, and free seats.
- Pool lifecycle and cascading passenger status updates.
- Server-Sent Events endpoint for ride/pool updates.
- Centralized validation, error handling, request logging, and audit logging.
- Jest tests for authentication, fares, capacity, concurrency, cancellation,
	and state-machine rules.

## Architecture

```mermaid
flowchart LR
		Browser[Browser]
		Next[Next.js App Router\nReact frontend]
		API[Node.js Express API\nTypeScript REST /api/v1]
		Prisma[Prisma ORM]
		DB[(PostgreSQL)]
		SSE[Server-Sent Events]

		Browser --> Next
		Next --> API
		API --> Prisma
		Prisma --> DB
		API --> SSE
		SSE --> Browser
```

The frontend is a Next.js App Router application. The backend is a single
Express API, keeping deployment and failure modes understandable for an MVP.
Prisma owns database access and migrations. SSE is used for lightweight live
status updates; the system does not require a message broker or queue.

## Database / ERD

```mermaid
erDiagram
		USER ||--o| VEHICLE : owns
		USER ||--o{ RIDE_REQUEST : books
		USER ||--o{ AUDIT_LOG : creates
		VEHICLE ||--o{ POOL : serves
		ROUTE ||--o{ ROUTE_STOP : contains
		STOP ||--o{ ROUTE_STOP : appears_in
		ROUTE ||--o{ POOL : uses
		STOP ||--o{ POOL : origin
		STOP ||--o{ POOL : destination
		STOP ||--o{ RIDE_REQUEST : pickup
		STOP ||--o{ RIDE_REQUEST : dropoff
		POOL ||--o{ RIDE_REQUEST : contains

		USER {
				uuid id PK
				string name
				string phone UK
				enum role
				int wallet_paisa
				boolean is_online
		}
		VEHICLE {
				uuid id PK
				string name
				string plate UK
				int capacity
				uuid driver_id FK
		}
		STOP {
				uuid id PK
				string name UK
				decimal lat
				decimal lng
		}
		ROUTE {
				uuid id PK
				string name
				string description
		}
		ROUTE_STOP {
				uuid route_id PK,FK
				uuid stop_id PK,FK
				int stop_order
		}
		POOL {
				uuid id PK
				enum status
				uuid vehicle_id FK
				uuid route_id FK
				uuid origin_stop_id FK
				uuid dest_stop_id FK
		}
		RIDE_REQUEST {
				uuid id PK
				int seats
				int fare_paisa
				enum status
				enum payment_method
				uuid passenger_id FK
				uuid pool_id FK
				uuid pickup_stop_id FK
				uuid dropoff_stop_id FK
		}
		AUDIT_LOG {
				uuid id PK
				string entity_type
				uuid entity_id
				string action
				json old_value
				json new_value
				uuid actor_id FK
		}
```

Money is stored as integer paisa (`1 BDT = 100 paisa`) to avoid floating-point
rounding. `AuditLog` is append-only at the application level and records
important status, matching, fare, pool, and driver-status events.

## Matching and Lifecycle

A request can join an open pool when it uses the same route and its pickup and
drop-off are covered by the pool's origin and destination in route order. The
matcher prefers older open pools. If no compatible pool has enough free seats,
the request remains `requested` for driver acceptance.

Ride states:

```text
requested -> matched -> driver_arrived -> started -> completed
requested -> cancelled
matched   -> cancelled       (driver only)
```

Pool states are `open`, `full`, `driver_arrived`, `started`, `completed`, or
`cancelled`. Invalid transitions are rejected. A driver changing a pool's
status cascades the corresponding status to its active rides.

## Concurrency: The Last Seat

Consider an open Bullet pool with one seat remaining while Nusrat and Shirin
submit bookings at nearly the same time. Both requests may initially observe
one free seat; that initial read is only a candidate check and is not the
decision that grants the seat.

The authoritative decision happens inside a PostgreSQL `Serializable`
transaction:

1. Find a compatible open pool.
2. Re-read the pool status inside the transaction.
3. Recalculate occupied seats from non-cancelled ride requests.
4. If capacity remains, create/match the ride and update the pool status.
5. If another transaction changes the same data concurrently, PostgreSQL
	aborts one transaction with a serialization/deadlock error. The matcher
	does not accept that stale result; it retries the next matching attempt,
	while the capacity check prevents both requests from being admitted.

Therefore, one request gets the last seat and the other cannot overbook Bullet.
The concurrency test exercises this behavior. The same transaction also
recalculates all affected passenger fares from one consistent segment-load
snapshot.

This is appropriate for the MVP because one PostgreSQL primary is the source
of truth and the critical section is short. It is not a distributed lock: an
external lock service is unnecessary at this scale. At larger scale, I would
make the reservation boundary explicit with an idempotency key and a pool
reservation/seat-allocation row, then use an atomic conditional update such as
`UPDATE ... SET reserved_seats = reserved_seats + :n WHERE reserved_seats + :n <= capacity`.
Matching workers would be partitioned by pool or route so hot pools are handled
serially, and transient serialization failures would use bounded exponential
backoff with a clear retryable response.

## Fare Model

The route distance is the sum of Haversine distances between consecutive
stops. The full-route fare is calculated as:

```text
routeFare = max(30 BDT, floor((routeDistanceKm * 10 BDT) / 10) * 10 BDT)
effectiveRate = routeFare / routeDistanceKm
```

For each segment a passenger rides, the effective segment cost is divided by
the number of passengers occupying that segment:

```text
passengerFare = max(5 BDT, sum(segmentDistance * effectiveRate / segmentLoad))
farePaisa = round(passengerFare * 100)
```

This means Nusrat and Rafiq can share the overlapping portion of a route while
paying different amounts for their own pickup-to-drop-off spans. The fare is
calculated and locked when a ride is matched. The estimate endpoint returns a
solo estimate and notes that a pooled fare may be lower.

## Tech Stack and Rationale

| Layer | Choice | Why it fits this MVP |
|---|---|---|
| Frontend | Next.js 16, React 19, TypeScript | App Router gives clear role-based pages and a standard React delivery model. |
| Backend | Node.js, Express, TypeScript | Small REST API with familiar middleware and explicit service boundaries. |
| Database | PostgreSQL 16 | Relational constraints and transactions suit pools, capacity, and lifecycle data. |
| ORM | Prisma 5 | Typed queries, migrations, and readable relation definitions. |
| Auth | JWT plus bcryptjs | Stateless API authentication with hashed passwords; suitable for this MVP. |
| Validation | Zod | Request validation close to each endpoint with useful error messages. |
| Realtime | Server-Sent Events | One-way status updates are enough without adding WebSocket infrastructure. |
| Tests | Jest and Supertest | Focused service and HTTP behavior tests. |
| Styling | CSS modules/global CSS and local UI components | Keeps the frontend lightweight and easy to change. |
| Runtime | Docker Compose | Reproducible local deployment with health-checked PostgreSQL. |

PostgreSQL could later be complemented by a read replica or Redis cache, and
SSE could later move to a managed realtime or event platform. Those additions
are not necessary for the current single-API MVP.

## Project Structure

```text
backend/
	prisma/              Prisma schema, migrations, and seed data
	src/routes/          REST resource and workflow endpoints
	src/services/        Matching, fare, state machine, and audit logic
	src/middleware/      Authentication, logging, and error handling
	__tests__/            Jest behavior and concurrency tests
frontend/
	src/app/              Next.js App Router pages for auth, passenger, driver
	src/components/       Reusable UI and ride/pool components
	src/hooks/            API, ride, pool, stops, and SSE hooks
docker-compose.yml      Full frontend, backend, and PostgreSQL stack
docker-compose.dev.yml  PostgreSQL-only development dependency
```

## Prerequisites

- Node.js 20 or newer
- npm
- Docker Desktop with Docker Compose
- PostgreSQL 16 if running the database outside Docker

## Local Setup

1. Start PostgreSQL using `docker compose -f docker-compose.dev.yml up -d`.
2. In `backend`, install dependencies with `npm install`.
3. Create `backend/.env` with values equivalent to:

	 ```env
	 DATABASE_URL=postgresql://postgres:password@localhost:5432/dhaka_tesla
	 JWT_SECRET=replace-with-a-local-secret
	 PORT=3001
	 NODE_ENV=development
	 ```

4. Run `npx prisma migrate deploy`, build the backend, and run the seed.
5. Start the API with `npm run dev`.
6. In `frontend`, run `npm install`, set
	 `NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1`, and run `npm run dev`.
7. Open `http://localhost:3000`.

The frontend and backend each contain their own `package.json`. Never commit a
real secret; use a local `.env` file or environment injection.

## Docker

The production-style local stack starts PostgreSQL, the API, and the frontend:

```bash

```

The API waits for PostgreSQL health, applies migrations, seeds the demo data,
and listens on `http://localhost:3001`. The frontend listens on
`http://localhost:3000`. The database is exposed on port `5432` and persists
in the `postgres_data` volume.

For a clean local database, stop the stack and remove the project volume with
Docker's normal volume-management commands. The seed intentionally clears and
recreates application data, so it should only be used for demo/development
environments.

## Demo Credentials

| Role | Name | Phone | Password |
|---|---|---|---|
| Driver | Jashim Uddin | 01711000001 | jashim123 |
| Passenger | Nusrat Jahan | 01711000002 | nusrat123 |
| Passenger | Rafiq Hossain | 01711000003 | rafiq123 |
| Passenger | Shirin Akter | 01711000004 | shirin123 |

Seeded vehicle: **Bullet**, plate `DHAKA-T-4201`, capacity `3`.

## API Overview

All versioned endpoints use the `/api/v1` prefix. Protected endpoints require
`Authorization: Bearer <jwt>`.

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/register` | Register a passenger or driver |
| POST | `/auth/login` | Issue a 24-hour JWT |
| GET | `/auth/me` | Return the authenticated profile |
| GET | `/stops` | List predefined stops |
| GET | `/routes` | List routes and ordered stops |
| GET | `/fare/estimate` | Calculate a solo fare estimate |
| POST | `/rides` | Book or enqueue a passenger ride |
| GET | `/rides` | List the passenger's own rides |
| GET | `/rides/:id` | View an authorized ride |
| PATCH | `/rides/:id/cancel` | Cancel while the lifecycle permits it |
| PATCH | `/driver/status` | Toggle driver online/offline |
| GET | `/driver/dashboard` | View vehicle, active pool, passengers, and seats |
| GET | `/pools/pending` | View unmatched requests as a driver |
| POST | `/pools/:rideRequestId/accept` | Accept a request into a pool |
| PATCH | `/pools/:poolId/status` | Advance or cancel a driver's pool |
| GET | `/sse/...` | Subscribe to live ride/pool updates |
| GET | `/health` | API health check |

## Testing

Backend tests are in `backend/__tests__` and can be run with:

```bash
cd backend
npm test
```

The suite covers authentication, fare calculation, Bullet capacity, invalid
state transitions, cancellation rules, passenger ownership, and concurrent
booking attempts. Capacity-sensitive matching runs in a PostgreSQL
`Serializable` transaction, rechecks the pool status and seat aggregate, and
retries the next candidate after serialization/deadlock conflicts. This keeps
two simultaneous requests from both claiming the last seat.

## Deployment Status

The repository includes a reproducible Docker deployment. No public deployment
URL is committed because this project does not depend on a paid hosting
provider. The compose stack is the reference deployment for evaluation.

## Bonus: If Oi Tesla Goes Viral

I would scale the system in stages instead of starting with a large
distributed system. PostgreSQL would remain the source of truth for seats,
fares, payments, and ride status.

### Main Changes at Scale

- Put a CDN, WAF, request limits, and rate limiting in front of the API.
- Run multiple stateless API servers behind a load balancer.
- Add indexes and read replicas for history, dashboards, and other read-heavy
  pages. Keep new bookings on the primary database for read-after-write
  consistency.
- Use Redis for short-lived route and availability data, but never trust it for
  the last seat or a payment balance.
- Use PostGIS or Redis GEO to find nearby drivers when the fleet grows to
  100,000 drivers.
- Move matching, notifications, fare updates, and audit events to a durable
  queue. Partition work by route or pool and retry failed jobs safely.
- Scale SSE or WebSocket servers horizontally with pub/sub, and let clients
  reconnect and refetch the current ride state.
- Add idempotency keys, timeouts, bounded retries, structured logs, metrics,
  tracing, backups, health checks, and rolling deployments.

The key rule stays the same: caches, replicas, and queues improve scale, but
only the PostgreSQL booking transaction can grant a seat or finalize a fare.

## Key Decisions and Trade-offs

- **REST over GraphQL:** the workflows are resource-oriented and small enough
	that explicit HTTP endpoints are easier to inspect and test.
- **Predefined routes over live maps:** deterministic route ordering makes
	matching and fare tests repeatable without external API keys.
- **Integer paisa over decimals in application code:** money cannot drift due to
	binary floating-point representation.
- **Serializable transactions over a distributed lock:** PostgreSQL already
	provides the required consistency for this deployment. At larger scale,
	contention could be reduced with reservation rows, idempotency keys, or a
	dedicated matching service.
- **SSE over WebSockets:** the current product mainly sends server-to-client
	status changes, so a simpler one-way channel is sufficient.

## Known Limitations

- Matching only supports the seeded, ordered routes; it is not geographic
	nearest-neighbor routing.
- Wallet balances and cash payments are simulated; there is no real payment
	gateway or settlement ledger.
- The compose file contains development credentials and must be configured
	with rotated secrets before any internet-facing deployment.
- There is no production hosting URL, push notification channel, ratings,
	refunds, or driver location tracking.

## Next Improvements

- Add idempotency keys and explicit reservation records for retry-safe booking.
- Add pagination, rate limiting, refresh tokens, and stronger production secret
	management.
- Add real payment handling, refunds, receipts, ratings, and trip invoices.
- Add geospatial indexing and route matching for a larger Dhaka network.
- Move live events behind a horizontally scalable event/realtime service.
- Add observability dashboards, structured metrics, and deployment automation.

## AI Usage

AI-assisted development was used throughout the project, but the implementation
workflow remained human-directed:

1. I first drafted the idea and acceptance criteria for each feature, including
	the system design, data model, API responsibilities, and user flow.
2. I drafted the implementation with AI assistance for code structure,
	documentation, and test-case brainstorming.
3. I manually reviewed the generated suggestions, merged the useful parts into
	the application, and adapted them to the existing architecture.
4. I debugged integration and behavior issues with AI assistance while keeping
	ownership of the final design and code.

One accepted suggestion was separating fare calculation, pool matching, and
the ride state machine into services so each business rule could be tested
independently. I rejected many AI suggestions that would have made the solution
overcomplicated, such as adding WebSockets when Server-Sent Events were enough
for the application's one-way status updates.

AI-generated or AI-assisted code was manually reviewed and remains my
responsibility to explain, debug, redesign, and modify.

## Demo Video

The current demo-video resource is available here:

https://drive.google.com/drive/u/0/folders/1HuR2s5kxgMEfmSkCC5rZ7IKN-DOJwY1J

The final submission should replace this folder link with the evaluator-facing
six-minute video URL when it is published.
