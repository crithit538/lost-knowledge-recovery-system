# Lost Knowledge Recovery System

DBMS MiniProject (Experiential Learning Level 3), PES University, Aug-Dec 2026

When employees leave, the knowledge only they held is lost. This system records knowledge items, tracks who owns them, flags items at risk when an owner departs, transfers knowledge to colleagues, and lets everyone find knowledge through search.

## Team

| Name | SRN | Main contribution |
|---|---|---|
| Vaishnavi | PES1UG24CS514 | Database design and implementation, advanced SQL, roles and row-level security, audit log, knowledge transfer, search API, role testing |
| Tejaswini R Pujar | PES1UG24CS500 | Web application (login, dashboard, Knowledge Library, Recovery Requests, User Management, My Contributions), Qdrant setup and embeddings |

## Features

- Knowledge items with categories, criticality (1 to 5) and draft, published or archived status
- Automatic version history whenever an item's content changes
- Departure tracking, with at-risk items shown on the dashboard
- Knowledge transfer from a departed employee to an active one (admin only)
- Audit log of key administrative actions (admin only)
- Recovery requests for missing knowledge
- Search over knowledge items
- Role-based access (admin, contributor, viewer) enforced inside the database

## Technology

| Part | Technology | Why |
|---|---|---|
| Relational database | PostgreSQL 18 | Triggers, procedures, recursive queries, roles and row-level security |
| Vector database | Qdrant Cloud | Meaning-based search over knowledge text |
| Embeddings | all-MiniLM-L6-v2 (Hugging Face Transformers) | Runs locally, 384-dimensional vectors |
| Web application | Next.js 16, React 19 | Interface and API routes in one project |
| Authentication | NextAuth.js (credentials, JWT sessions) | Login with role stored in the session |

Structured, rule-heavy data (users, ownership, versions, requests) lives in PostgreSQL. Free-text knowledge that is searched by meaning belongs in a vector database, so each tool does what it does best.

## Repository structure

```
db/        SQL scripts (schema, seed data, triggers, security, queries)
docs/      ER diagram
web/       Next.js application
README.md  This file
```

## Getting started

### 1. Database

Create a database named `knowledge_recovery`, then run these files in this order, each only once:

1. `db/schema.sql` (tables, keys and constraints)
2. `db/seed.sql` (test data)
3. `db/advanced.sql` (version trigger, risk score function, transfer procedure)
4. `db/audit.sql` (audit logging triggers)
5. `db/security.sql` (database roles and row-level security)

Optional: `db/queries.sql` (sample queries) and `db/dml.sql` (INSERT, UPDATE and DELETE examples).

The login role used by the web app is `kr_app`. Set its password in PostgreSQL before using it:

```sql
ALTER ROLE kr_app PASSWORD 'your_password';
```

### 2. Web application

```bash
cd web
npm install
```

Create `web/.env.local`:

```env
DATABASE_URL=postgres://kr_app:your_password@localhost:5432/knowledge_recovery
NEXTAUTH_SECRET=any_long_random_text
QDRANT_URL=your_qdrant_cluster_url
QDRANT_API_KEY=your_qdrant_api_key
```

If the password contains special characters such as `@`, URL-encode them. Never commit `.env.local`.

```bash
npm run dev
```

Open http://localhost:3000. More setup notes are in `web/README.md`.

### Test accounts

Every seeded account uses the password `Password@123` (test data only).

| Role | Email |
|---|---|
| Admin | asha@example.com |
| Contributor | ravi@example.com |
| Contributor | meena@example.com |
| Viewer | divya@example.com |

`karthik@example.com` is a departed employee who owns the at-risk items used in the transfer demo.

## Database design

The ER diagram is in [`docs/er-diagram.pdf`](docs/er-diagram.pdf).

### Relational schema

| Table | Primary key | Foreign keys | Main constraints |
|---|---|---|---|
| department | dept_id | none | name unique and not null |
| app_user | user_id | dept_id references department | email unique; role in (admin, contributor, viewer); status in (active, departed); departure date required when departed |
| category | category_id | parent_id references category | name not null (self-referencing hierarchy) |
| knowledge_item | item_id | owner_id references app_user; category_id references category | criticality between 1 and 5; status in (draft, published, archived) |
| item_version | version_id | item_id references knowledge_item (cascade delete) | unique (item_id, version_no) |
| tag | tag_id | none | name unique |
| item_tag | (item_id, tag_id) | item_id references knowledge_item; tag_id references tag | both cascade on delete |
| recovery_request | request_id | requester_id and assigned_to reference app_user; item_id references knowledge_item | status in (open, assigned, resolved) |
| audit_log | log_id | actor_id references app_user | action not null |

## Advanced SQL

| Object | Name | Purpose |
|---|---|---|
| Trigger | `item_versioning` | Saves the old body in `item_version` whenever an item's content changes |
| Trigger | `audit_departure` | Logs when a user is marked as departed |
| Trigger | `audit_archive` | Logs when an item is archived |
| Function | `fn_risk_score(user_id)` | Counts the critical items (criticality 4 or 5) a user owns |
| Procedure | `transfer_knowledge(from, to, actor)` | Moves a departed user's items to an active user and writes an audit entry |
| Queries | `db/queries.sql` | Recursive CTE (category tree), correlated query, nested query, join query |

## Access control

Three database roles are used: `kr_admin`, `kr_contributor` and `kr_viewer`. The web app connects as `kr_app` and, for every request, switches to the role of the logged-in user with `SET LOCAL ROLE` inside a transaction (the `withRole` helper in `web/lib/db.js`). The role name comes from a fixed list, never from user input.

| Role | Can do |
|---|---|
| Admin | Everything, including user management, knowledge transfer and the audit log |
| Contributor | Read published items and their own drafts; create items; edit only their own items; raise and update recovery requests |
| Viewer | Read published items; raise recovery requests |

Row-level security policies on `knowledge_item` enforce this inside PostgreSQL, so even a direct database call cannot bypass it. Only `kr_admin` can run `transfer_knowledge`, and password hashes are not readable by contributors or viewers.

## Modules

### Audit log (admin only)
Page `/audit-log`, API `GET /api/audit` (optional `?action=` filter). Each entry stores the acting user, the action, the target table and id, details and the time. Entries are written by the triggers and the transfer procedure.

### Knowledge transfer (admin only)
Page `/transfer`, API `GET /api/transfer` and `POST /api/transfer`. The admin picks a departed employee and an active employee. The procedure checks both, moves the non-archived items and records the transfer in the audit log.

### Search
API `GET /api/search?q=...` for any logged-in user. The search finds matching item ids, then loads the items through the user's own database role, so row-level security still hides anything the user must not see. Creating or editing a published item calls `upsertItemVector`, and moving an item to draft or archived calls `deleteItemVector`. A vector failure never undoes the database save.

## Testing

| Account | Check | Result |
|---|---|---|
| Viewer | Sees published items only, no create or edit | Pass |
| Viewer | `/users`, `/transfer` and `/audit-log` redirect; `/api/audit` returns 403 | Pass |
| Contributor | Creates an item and becomes its owner | Pass |
| Contributor | Edits own item and version history is updated | Pass |
| Contributor | Cannot edit another user's item (the database refuses) | Pass |
| Contributor | Admin pages and APIs are blocked | Pass |
| Admin | Transfer, audit log and user management work | Pass |
| Not logged in | `/api/search` returns Unauthorized | Pass |

## Project status

- Complete: database, advanced SQL, roles and row-level security, audit log, knowledge transfer, search API, role-based testing
- In progress: Qdrant integration. `web/lib/vectors.js` currently contains a simple stand-in that returns the same result shapes; it will be replaced by the Qdrant implementation (collection `knowledge_chunks`, 384 dimensions, cosine distance).