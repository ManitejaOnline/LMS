# Architecture Decisions — Phase 2 Auth & Users

## AD-20: Role vocabulary finalized as SUPER_ADMIN / ADMIN / MANAGER / EMPLOYEE

Replaced foundation placeholders (`SYSTEM_ADMIN`, `TRAINING_ADMIN`) to match product language.

## AD-21: Refresh tokens stored hashed + rotated

Raw refresh JWT never persisted. SHA-256 hash stored; refresh rotates and revokes previous token (reuse detection path ready via `replacedByTokenId`).

## AD-22: Forgot-password without email provider yet

Reset tokens issued and hashed. In non-production, token is logged/returned for local testing. Production responses stay generic (no user enumeration).

## AD-23: Soft delete for users and departments

`deletedAt` filters all queries. Soft-deleted users have refresh sessions revoked. Super Admin cannot be soft-deleted.

## AD-24: Audit log append-only

Auth and admin mutations write `audit_logs` with actor, action, entity, and client metadata.

## AD-25: Privilege-aware role assignment

Actors cannot assign roles above their rank; only Super Admin can create Super Admin.

## AD-26: UI extends existing teal corporate system

Dashboard shell reuses foundation CSS variables and PrimeNG controls — spacious, minimal, dashboard-oriented — no new design language.
