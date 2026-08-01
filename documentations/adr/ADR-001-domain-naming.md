# ADR-001: Domain Naming — `Ride` / `RidePromo` (Code) vs. `Attraction` / `Attraction Bundle` (Product)

| | |
|---|---|
| **Status** | Accepted |
| **Scope** | AmuseFlowWebAPI (backend, database), amuseflow-frontend |
| **Last updated** | 2026-08-01 |

## Context

The product's user-facing vocabulary was changed from "Ride" / "Ride Promo" to
"Attraction" / "Attraction Bundle" across every surface a user, admin, or
attendant interacts with. This included UI copy, toasts, validation and error
messages returned by the API, activity-log text, and the formal Use Case
Document.

The backend domain model, database schema, and API contract were **not**
renamed in the same pass. This document records that decision, the reasoning
behind it, and the exact boundary between what changed and what didn't, so the
divergence is understood as a deliberate engineering decision rather than
incomplete work.

## Decision

Product terminology and implementation terminology are allowed to diverge.
Specifically:

| Layer | Convention |
|---|---|
| Database (tables, columns) | `Ride`, `RidePromo`, `RideId`, `PromoId`, `PromoDate`, `RideSchedule`, etc. |
| Domain/data layer (Entities, DTOs, Interfaces, Repositories, Services, Controllers) | `Ride`, `RidePromo`, `RideService`, `RidePromoController`, etc. |
| Wire contract (API routes) | `/api/ride/*`, `/api/ridepromo/*` |
| Frontend data layer (`types.ts`, `api.ts`) | `Ride`, `RidePromo`, `RidePromoRide`, `rideApi`, `promoApi` — mirrors the wire contract intentionally |
| Presentation layer (any string rendered to a human: UI copy, API-returned validation/error messages, activity-log text, generated documents) | `Attraction`, `Attraction Bundle` |

**Rule of thumb:** if it's a symbol the compiler resolves or a value persisted
to storage, it uses `Ride`/`RidePromo`. If it's a value a human reads, it uses
`Attraction`/`Attraction Bundle`. The presentation layer translates between the
two at its boundary (see exceptions below for the one place this translation
is explicit code, `moduleLabel()`).

## Symbol reference

| Domain symbol | Product term it represents |
|---|---|
| `Ride` entity / `Rides` table | Attraction |
| `RidePromo` entity / `RidePromos` table | Attraction Bundle |
| `RidePromoRide` entity / `RidePromoRides` table | An attraction's membership in a bundle |
| `RideSchedule` entity / `RideSchedules` table | Attraction schedule / slot |
| `RideReview` entity / `RideReviews` table | Attraction review |
| `RideValidationSettings` | Attraction validation settings |
| `RideService` / `IRideService` / `RideRepository` / `IRideRepository` / `RideController` | Attraction domain logic (no 1:1 product-facing name) |
| `RidePromoService` / `IRidePromoService` / `RidePromoRepository` / `IRidePromoRepository` / `RidePromoController` | Attraction Bundle domain logic |
| `CreateRideRequest` / `UpdateRideRequest` / `RideResponse` | Create / Update / View an Attraction |
| `CreateRidePromoRequest` / `UpdateRidePromoRequest` / `RidePromoResponse` | Create / Update / View an Attraction Bundle |
| `RideId` (column/property) | Foreign key to an Attraction |
| `PromoId` (column/property) | Foreign key to an Attraction Bundle |
| `PromoDate` (column/property) | An Attraction Bundle's date |
| `Ride` / `RidePromo` (frontend `types.ts`), `rideApi` / `promoApi` (`api.ts`) | Mirror the backend contract above |

## Exceptions — values excluded from this mapping

The following are **stored or compared values**, not display strings. They are
explicitly out of scope and must not be renamed as part of this convention.
Each has a concrete technical reason:

### 1. `Role = "Ride Attendant"`

Persisted in `Users.Role`, asserted via `[Authorize(Roles = "Ride Attendant")]`
on every attendant-only endpoint, and embedded in issued JWT claims. Renaming
this literal is a breaking change to every existing account: it would require
a coordinated data migration (`UPDATE Users SET Role = ...`) and invalidate any
outstanding tokens that still carry the old claim value. Treated as a stable
identifier, not display text — unaffected by this ADR, in code and in the UI.

### 2. `ActivityModule.Ride` (constant value `"Ride"`)

The literal value tags every row in `ActivityLogs.Module` and is passed as a
query parameter for log filtering. Existing rows already persist `Module =
"Ride"`. Changing the constant's value is a data-shape change requiring a
backfill of historical rows; changing only the constant without a backfill
would silently break filtering against pre-existing data.

The presentation-layer translation for this one *is* explicit code — the only
such case in the system:

```tsx
// src/pages/admin/Logs.tsx
// ✅ UI-only display label — the underlying module value stays 'Ride'
// (matches the backend-logged ActivityLog.Module value), only the text
// shown to the admin is renamed to "Attraction".
const moduleLabel = (m: string) => m === 'Ride' ? 'Attraction' : m
```

### 3. `RideSchedule.ScheduleType` (literal values `"Regular"` / `"Promo"`)

A two-value discriminator column, compared by reference throughout
`BookingService`, `ScheduleService`, and `RidePromoService` (e.g.
`schedule.ScheduleType != "Promo"`) and mirrored on the frontend (e.g.
`(['Regular', 'Promo'] as const)`). This is load-bearing business logic, not
copy — renaming the literal requires updating every comparison site in both
codebases atomically, with no room for a partial rollout. The *displayed*
label is "Attraction Bundle"; the *compared* value stays `"Promo"`.

## Rationale

The domain model's shape is ride-specific: `MaxCapacity`, `DurationMinutes`,
`MinHeightCm`/`MaxHeightCm`, `MinAgeYears`/`MaxAgeYears`, `MinWeightKg`/
`MaxWeightKg`, and a `CallTime`-based boarding schedule are all attributes of a
mechanical ride, not of a generic attraction (a show or walkthrough wouldn't
have a height/weight gate or vehicle capacity). `Ride` is therefore the more
accurate name for what the schema and domain model actually represent — a
rename to `Attraction` at this layer would overstate the model's generality
without changing its shape.

Renaming the domain/data/schema layer to match is a large, high-blast-radius
change — on the order of 60–70 files across entities, DTOs, interfaces,
repositories, services, controllers, database tables/columns/foreign keys, API
routes, and the frontend's data layer — for zero externally observable
benefit, since no user, admin, or attendant ever encounters the internal
names. Divergence between internal implementation names and current product
terminology is a common, low-priority form of technical debt in mature
systems, not a defect requiring urgent remediation.

## Consequences

- New contributors reading the schema/codebase for the first time will see
  `Ride`/`RidePromo` and must consult this document to map it to current
  product terminology.
- The API's wire contract (`/api/ride/*`, JSON field names like `rideId`) does
  not match the product's current vocabulary. Any new API consumer must be
  made aware of this mapping.
- If the product introduces a genuinely distinct attraction type in the
  future (one without ride-specific attributes), that is the appropriate
  trigger to introduce a proper `Attraction` abstraction — designed
  deliberately, with `Ride` as one implementation of it — rather than renaming
  the current model in place.

## Guidance for contributors

- New database objects, entities, DTOs, interfaces, repositories, services,
  controllers, and API routes: use `Ride` / `RidePromo` naming, consistent
  with the existing domain model.
- New frontend data-layer code (`types.ts`, `api.ts`): mirror the backend
  contract using the same naming.
- New user-facing text — UI copy, error/validation messages, log messages,
  generated documents: use "Attraction" / "Attraction Bundle" wording,
  consistent with the presentation layer.
- Do not attempt to reconcile the two naming schemes opportunistically; any
  future rename of the domain/data layer should be a scoped, standalone
  change with its own migration plan, not an incidental edit.
