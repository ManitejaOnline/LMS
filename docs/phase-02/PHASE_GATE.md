# Phase 2 — Authentication & User Management

## API surface

### Auth (`/api/v1/auth`)
| Method | Path | Access |
|---|---|---|
| POST | `/login` | Public |
| POST | `/logout` | Authenticated |
| POST | `/refresh` | Public |
| POST | `/forgot-password` | Public |
| POST | `/reset-password` | Public |
| POST | `/change-password` | Authenticated |

### Users (`/api/v1/users`)
| Method | Path | Roles |
|---|---|---|
| GET | `/me` | Any authenticated |
| PATCH | `/me` | Any authenticated |
| GET | `/` | SUPER_ADMIN, ADMIN, MANAGER |
| GET | `/:id` | SUPER_ADMIN, ADMIN, MANAGER |
| POST | `/` | SUPER_ADMIN, ADMIN |
| PATCH | `/:id` | SUPER_ADMIN, ADMIN |
| DELETE | `/:id` | SUPER_ADMIN, ADMIN (soft delete) |

### Departments (`/api/v1/departments`)
CRUD with search + pagination; mutations require SUPER_ADMIN/ADMIN.

## Roles
`SUPER_ADMIN` · `ADMIN` · `MANAGER` · `EMPLOYEE`

## Seed
```
SEED_SUPER_ADMIN_EMAIL=superadmin@zebl.local
SEED_SUPER_ADMIN_PASSWORD=ChangeMe!SuperAdmin1
```

## Local DB note
Update `apps/api/.env` `DATABASE_URL` to match your PostgreSQL credentials, then:

```bash
npm run prisma:migrate:deploy -w @zebl/api
npm run prisma:seed -w @zebl/api
```
