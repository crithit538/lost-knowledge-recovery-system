# DBMS MiniProject Report

---

## 1. Title
**Lost Knowledge Recovery System**  
*Experiential Learning Level 3 — Department of Computer Science and Engineering, PES University*

---

## 2. Students SRN and Name

| Sl. No. | Student Name | SRN | Primary Contribution |
|:---:|:---|:---:|:---|
| 1 | **Vaishnavi** | PES1UG24CS514 | Database Architecture & Schema Design, Advanced SQL (Triggers, Stored Procedures, Functions), Database Roles & Row-Level Security (RLS), Audit Logging, Knowledge Transfer Procedure, Search API Backend |
| 2 | **Tejaswini R Pujar** | PES1UG24CS500 | Next.js Full-Stack Web Application (App Router, Authentication, Dashboard, Knowledge Library, Recovery Requests, Contributions UI), Qdrant Cloud Vector Database Setup, Hugging Face Local Embeddings Pipeline, Vector Sync Hooks |

---

## 3. Abstract

In modern organizations, tacit knowledge, mission-critical deployment procedures, and debugging workflows often reside solely with individual employees. When an employee departs, this intellectual capital is abruptly lost, leading to system outages, duplicated effort, and operational vulnerability.

The **Lost Knowledge Recovery System** solves this critical institutional challenge by integrating a relational database (**PostgreSQL 18**) with a high-performance vector search engine (**Qdrant Cloud**). Structured data—such as user identities, hierarchical categories, revision histories, transfer workflows, and audit logs—is strictly governed inside PostgreSQL with custom database roles (`kr_admin`, `kr_contributor`, `kr_viewer`) and database-enforced Row-Level Security (RLS). When an employee departs, an automated database trigger identifies at-risk assets, allowing administrators to execute atomic knowledge transfer procedures. Simultaneously, unstructured technical text is embedded using the `all-MiniLM-L6-v2` transformer model (384 dimensions) and indexed in Qdrant. This enables natural language semantic search, allowing engineers to discover relevant recovery procedures even when phrasing differs completely from exact keywords.

---

## 4. Tech Stack

| Layer | Technology | Version | Purpose & Rationale |
|:---|:---|:---:|:---|
| **Relational Database** | PostgreSQL | 18 | ACID transactional integrity, triggers, stored procedures, recursive CTEs, role-based access control, and row-level security (RLS). |
| **Vector Database** | Qdrant Cloud | REST API v1.20 | Cosine-distance vector similarity search over 384-dimensional dense vectors with payload metadata filtering. |
| **Embedding Model** | Xenova/all-MiniLM-L6-v2 | via `@huggingface/transformers` 4.3 | Local client-side/serverless feature extraction generating normalized 384-dimensional embeddings without third-party API dependencies. |
| **Web Framework** | Next.js | 16.4.3 (Turbopack) | React 19 server-side rendering, React Client components, and unified API Route handlers. |
| **Authentication** | NextAuth.js | 4.24.15 | Secure credentials-based authentication with bcrypt hashing and JWT role propagation. |
| **Database Driver** | `pg` (node-postgres) | 8.23.1 | Transactional PostgreSQL client with connection pooling and dynamic session-level role switching (`SET LOCAL ROLE`). |
| **Version Control** | Git & GitHub | — | Multi-branch collaborative workflow (`tejaswini-web` & `vaishnavi-audit`). |

---

## 5. SQL — Database Commands

### 5.1 Data Definition Language (DDL) — Schema Creation

```sql
-- Enable cryptographic functions for secure password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Department Table
CREATE TABLE department (
  dept_id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE
);

-- 2. User Table with Role & Status Constraints
CREATE TABLE app_user (
  user_id SERIAL PRIMARY KEY,
  dept_id INT REFERENCES department(dept_id),
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin','contributor','viewer')),
  status VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active','departed')),
  departed_on DATE,
  CHECK (status = 'active' OR departed_on IS NOT NULL)
);

-- 3. Self-Referencing Category Hierarchy
CREATE TABLE category (
  category_id SERIAL PRIMARY KEY,
  parent_id INT REFERENCES category(category_id),
  name VARCHAR(100) NOT NULL
);

-- 4. Knowledge Item Table
CREATE TABLE knowledge_item (
  item_id SERIAL PRIMARY KEY,
  owner_id INT NOT NULL REFERENCES app_user(user_id),
  category_id INT REFERENCES category(category_id),
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  criticality SMALLINT NOT NULL CHECK (criticality BETWEEN 1 AND 5),
  status VARCHAR(10) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Version History Table
CREATE TABLE item_version (
  version_id SERIAL PRIMARY KEY,
  item_id INT NOT NULL REFERENCES knowledge_item(item_id) ON DELETE CASCADE,
  version_no INT NOT NULL,
  body TEXT NOT NULL,
  edited_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (item_id, version_no)
);

-- 6. Tags & Association Tables
CREATE TABLE tag (
  tag_id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE item_tag (
  item_id INT NOT NULL REFERENCES knowledge_item(item_id) ON DELETE CASCADE,
  tag_id INT NOT NULL REFERENCES tag(tag_id) ON DELETE CASCADE,
  PRIMARY KEY (item_id, tag_id)
);

-- 7. Recovery Requests Table
CREATE TABLE recovery_request (
  request_id SERIAL PRIMARY KEY,
  requester_id INT NOT NULL REFERENCES app_user(user_id),
  item_id INT REFERENCES knowledge_item(item_id),
  assigned_to INT REFERENCES app_user(user_id),
  topic VARCHAR(200) NOT NULL,
  details TEXT,
  status VARCHAR(10) NOT NULL DEFAULT 'open' CHECK (status IN ('open','assigned','resolved')),
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- 8. Audit Log Table
CREATE TABLE audit_log (
  log_id SERIAL PRIMARY KEY,
  actor_id INT REFERENCES app_user(user_id),
  action VARCHAR(50) NOT NULL,
  target_table VARCHAR(50),
  target_id INT,
  details TEXT,
  logged_at TIMESTAMPTZ DEFAULT now()
);
```

### 5.2 Advanced SQL (Triggers, Procedures, Functions)

#### Trigger 1: Automatic Item Versioning
```sql
CREATE OR REPLACE FUNCTION trg_version_item() RETURNS trigger AS $$
BEGIN
  IF NEW.body IS DISTINCT FROM OLD.body THEN
    INSERT INTO item_version (item_id, version_no, body)
    SELECT OLD.item_id, COALESCE(MAX(version_no), 0) + 1, OLD.body
    FROM item_version WHERE item_id = OLD.item_id;
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER item_versioning
BEFORE UPDATE ON knowledge_item
FOR EACH ROW EXECUTE FUNCTION trg_version_item();
```

#### Trigger 2: Audit Logging on Employee Departure
```sql
CREATE OR REPLACE FUNCTION trg_audit_departure() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'departed' AND OLD.status <> 'departed' THEN
    INSERT INTO audit_log (actor_id, action, target_table, target_id, details)
    VALUES (NULLIF(current_setting('app.user_id', true), '')::int,
            'USER_DEPARTED', 'app_user', NEW.user_id,
            NEW.full_name || ' marked as departed');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER audit_departure AFTER UPDATE ON app_user
FOR EACH ROW EXECUTE FUNCTION trg_audit_departure();
```

#### Trigger 3: Audit Logging on Knowledge Item Archiving
```sql
CREATE OR REPLACE FUNCTION trg_audit_archive() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'archived' AND OLD.status <> 'archived' THEN
    INSERT INTO audit_log (actor_id, action, target_table, target_id, details)
    VALUES (NULLIF(current_setting('app.user_id', true), '')::int,
            'ITEM_ARCHIVED', 'knowledge_item', NEW.item_id,
            'Archived: ' || NEW.title);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER audit_archive AFTER UPDATE ON knowledge_item
FOR EACH ROW EXECUTE FUNCTION trg_audit_archive();
```

#### Stored Procedure: Atomic Knowledge Transfer
```sql
CREATE OR REPLACE PROCEDURE transfer_knowledge(p_from INT, p_to INT, p_actor INT)
LANGUAGE plpgsql AS $$
DECLARE v_count INT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM app_user WHERE user_id = p_from AND status = 'departed') THEN
    RAISE EXCEPTION 'Source user must be departed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM app_user WHERE user_id = p_to AND status = 'active') THEN
    RAISE EXCEPTION 'Target user must be active';
  END IF;

  UPDATE knowledge_item SET owner_id = p_to
  WHERE owner_id = p_from AND status <> 'archived';
  GET DIAGNOSTICS v_count = ROW_COUNT;

  INSERT INTO audit_log (actor_id, action, target_table, target_id, details)
  VALUES (p_actor, 'TRANSFER_KNOWLEDGE', 'knowledge_item', p_from,
          v_count || ' items moved from user ' || p_from || ' to user ' || p_to);
END $$;
```

#### Stored Function: Critical Risk Calculation
```sql
CREATE OR REPLACE FUNCTION fn_risk_score(p_user INT) RETURNS INT AS $$
  SELECT COUNT(*)::INT FROM knowledge_item
  WHERE owner_id = p_user AND criticality >= 4 AND status <> 'archived';
$$ LANGUAGE sql;
```

### 5.3 Security, Role-Based Access Control & Row-Level Security (RLS)

```sql
-- Role Definitions
CREATE ROLE kr_admin NOLOGIN;
CREATE ROLE kr_contributor NOLOGIN;
CREATE ROLE kr_viewer NOLOGIN;
CREATE ROLE kr_app LOGIN NOINHERIT PASSWORD 'SecurePassword123';

GRANT kr_admin, kr_contributor, kr_viewer TO kr_app;
GRANT USAGE ON SCHEMA public TO kr_app, kr_admin, kr_contributor, kr_viewer;
GRANT SELECT ON app_user TO kr_app; -- login verification only

-- Row-Level Security (RLS) Policies on Knowledge Items
ALTER TABLE knowledge_item ENABLE ROW LEVEL SECURITY;

-- 1. Admin Policy: Full Unrestricted Access
CREATE POLICY admin_all ON knowledge_item
  FOR ALL TO kr_admin USING (true) WITH CHECK (true);

-- 2. Viewer Policy: Read Published Items Only
CREATE POLICY viewer_read ON knowledge_item
  FOR SELECT TO kr_viewer USING (status = 'published');

-- 3. Contributor Policies: Read Published OR Own Drafts; Modify Own Items Only
CREATE POLICY contributor_read ON knowledge_item
  FOR SELECT TO kr_contributor
  USING (status = 'published'
         OR owner_id = NULLIF(current_setting('app.user_id', true), '')::int);

CREATE POLICY contributor_insert ON knowledge_item
  FOR INSERT TO kr_contributor
  WITH CHECK (owner_id = NULLIF(current_setting('app.user_id', true), '')::int);

CREATE POLICY contributor_update ON knowledge_item
  FOR UPDATE TO kr_contributor
  USING (owner_id = NULLIF(current_setting('app.user_id', true), '')::int)
  WITH CHECK (owner_id = NULLIF(current_setting('app.user_id', true), '')::int);
```

### 5.4 Advanced Sample Query: Recursive CTE for Category Hierarchy
```sql
WITH RECURSIVE category_tree AS (
  SELECT category_id, parent_id, name, 1 AS depth, name::text AS path
  FROM category
  WHERE parent_id IS NULL
  UNION ALL
  SELECT c.category_id, c.parent_id, c.name, ct.depth + 1, ct.path || ' > ' || c.name
  FROM category c
  JOIN category_tree ct ON c.parent_id = ct.category_id
)
SELECT depth, path, category_id FROM category_tree ORDER BY path;
```

---

## 6. NoSQL / Vector Database Commands

Vector search is orchestrated via the **Qdrant REST client** (`@qdrant/js-client-rest`) operating on Qdrant Cloud.

### 6.1 Collection Creation & Indexing Parameters
```javascript
// Qdrant Collection Definition: 384 dimensions, Cosine distance
await qdrant.createCollection('knowledge_chunks', {
  vectors: {
    size: 384,
    distance: 'Cosine',
  },
});
```

### 6.2 Vector Upsert (Insertion / Synchronization)
When a knowledge item is created or updated with `status = 'published'`, it is converted into a normalized vector and upserted:
```javascript
// From web/lib/vectors.js
await qdrant.upsert('knowledge_chunks', {
  wait: true,
  points: [
    {
      id: itemId,               // Integer ID matching PostgreSQL item_id
      vector: denseVector384,   // 384-dimensional array of floats
      payload: {
        item_id: itemId,
        title: item.title,
        dept_id: item.dept_id,
        category_id: item.category_id,
      },
    },
  ],
});
```

### 6.3 Semantic Search Query Execution
Searches query embeddings against stored vectors with similarity scoring:
```javascript
// From web/lib/vectors.js
const response = await qdrant.query('knowledge_chunks', {
  query: queryVector384,
  limit: 10,
  with_payload: true,
});

// Returns matches sorted by Cosine similarity score (e.g., 0.7326 for "billing deploy")
const results = response.points.map((pt) => ({
  itemId: pt.payload.item_id,
  score: pt.score,
}));
```

### 6.4 Vector Deletion
When an item is moved to `'draft'`, `'archived'`, or deleted in PostgreSQL:
```javascript
// From web/lib/vectors.js
await qdrant.delete('knowledge_chunks', {
  wait: true,
  points: [Number(itemId)],
});
```

---

## 7. Next.js — Project Tree Structure

```
lost-knowledge-recovery-system/
├── db/
│   ├── advanced.sql              # Version trigger, risk score function, transfer procedure
│   ├── audit.sql                 # Departure and archive audit triggers
│   ├── dml.sql                   # Sample DML operations
│   ├── queries.sql               # Recursive CTEs, joins, and aggregations
│   ├── schema.sql                # Table definitions, constraints, foreign keys
│   ├── security.sql              # Roles (kr_admin, kr_contributor, kr_viewer) & RLS policies
│   └── seed.sql                  # Initial seed data for users, departments, and knowledge
├── docs/
│   └── er-diagram.pdf            # Formal Entity-Relationship diagram
├── web/
│   ├── app/
│   │   ├── api/
│   │   │   ├── audit/
│   │   │   │   └── route.js      # GET /api/audit (admin audit logs with filters)
│   │   │   ├── auth/
│   │   │   │   └── [...nextauth]/
│   │   │   │       └── route.js  # NextAuth session & credentials route
│   │   │   ├── dashboard/
│   │   │   │   └── route.js      # GET /api/dashboard (stats, recent items, at-risk count)
│   │   │   ├── knowledge/
│   │   │   │   ├── route.js      # GET, POST /api/knowledge (list, create & vector sync)
│   │   │   │   └── [id]/
│   │   │   │       └── route.js  # GET, PATCH /api/knowledge/:id (details, update & vector sync)
│   │   │   ├── recovery-requests/
│   │   │   │   ├── route.js      # GET, POST /api/recovery-requests
│   │   │   │   └── [id]/
│   │   │   │       └── route.js  # PATCH /api/recovery-requests/:id (admin assignment/status)
│   │   │   ├── search/
│   │   │   │   └── route.js      # GET /api/search (semantic search + PostgreSQL RLS recheck)
│   │   │   ├── transfer/
│   │   │   │   └── route.js      # GET, POST /api/transfer (executes transfer_knowledge)
│   │   │   └── users/
│   │   │       └── route.js      # GET, PATCH /api/users (user list & departure toggle)
│   │   ├── audit-log/
│   │   │   └── page.js           # Admin audit log dashboard
│   │   ├── knowledge/
│   │   │   ├── [id]/
│   │   │   │   ├── edit/
│   │   │   │   │   └── page.js   # Edit knowledge item & update status
│   │   │   │   └── page.js       # View knowledge details, versions, and submit recovery request
│   │   │   ├── new/
│   │   │   │   └── page.js       # Create new knowledge entry
│   │   │   └── page.js           # Knowledge Library with keyword & semantic search
│   │   ├── login/
│   │   │   └── page.js           # Credentials login interface
│   │   ├── my-contributions/
│   │   │   └── page.js           # Personal contributions view for contributors
│   │   ├── recovery-requests/
│   │   │   └── page.js           # Recovery requests tracker & admin controls
│   │   ├── transfer/
│   │   │   └── page.js           # Knowledge transfer workflow interface
│   │   ├── users/
│   │   │   └── page.js           # Employee directory & departure management
│   │   ├── globals.css           # Global application styles
│   │   ├── layout.js             # Root layout with font and session provider
│   │   ├── page.js               # Main Dashboard with metrics and role-based sidebar
│   │   └── providers.js          # NextAuth client session provider wrapper
│   ├── lib/
│   │   ├── authOptions.js        # NextAuth credentials strategy & bcrypt comparison
│   │   ├── db.js                 # PostgreSQL connection pool & withRole transaction wrapper
│   │   ├── embeddings.js         # Hugging Face pipeline (all-MiniLM-L6-v2)
│   │   ├── qdrant.js             # Qdrant client connection singleton
│   │   └── vectors.js            # Semantic vector search, upsert, and delete operations
│   ├── .env.local                # Local environment secrets (DATABASE_URL, QDRANT_*, NEXTAUTH_*)
│   ├── jsconfig.json             # Path alias mapping (@/* to root)
│   ├── next.config.mjs           # Next.js build configuration
│   ├── package.json              # Project dependencies and npm scripts
│   └── README.md                 # Web app setup instructions
└── README.md                     # Main repository documentation & project overview
```

---

## 8. Sample Screenshots of Application Code and Demo

### 8.1 Key Application Code Highlights

#### Dynamic Database Role Switching with PostgreSQL Row-Level Security (`web/lib/db.js`)
```javascript
export async function withRole(userId, role, callback) {
  const dbRole = allowedRoles[role]; // 'kr_admin', 'kr_contributor', or 'kr_viewer'
  if (!dbRole) throw new Error('Invalid database role');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Switch connection to unprivileged or specific role
    await client.query(`SET LOCAL ROLE ${dbRole}`);
    // Expose application user ID to PostgreSQL RLS policies
    await client.query("SELECT set_config('app.user_id', $1, true)", [String(userId)]);

    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

#### Vector Search and RLS Re-verification Pipeline (`web/app/api/search/route.js`)
```javascript
// Step 1: Query Qdrant for semantic similarity matches
const matches = await searchVectors(queryText, 10);
const ids = matches.map((m) => m.itemId);

// Step 2: Reload matching IDs through the user's role — RLS prevents unauthorized leakage!
const items = await withRole(token.id, token.role, async (client) => {
  const result = await client.query(
    `SELECT k.item_id, k.title, k.criticality, k.status, c.name AS category,
            u.full_name AS owner, LEFT(k.body, 200) AS snippet
     FROM knowledge_item k
     LEFT JOIN category c ON c.category_id = k.category_id
     LEFT JOIN app_user u ON u.user_id = k.owner_id
     WHERE k.item_id = ANY($1::int[])`,
    [ids]
  );
  return result.rows;
});

// Step 3: Attach Cosine similarity scores to accessible rows
const byId = new Map(items.map((i) => [i.item_id, i]));
const results = matches
  .filter((m) => byId.has(m.itemId))
  .map((m) => ({ ...byId.get(m.itemId), score: m.score }));
```

---

### 8.2 Application Demo Views & UI Screens

```
+----------------------------------------------------------------------------------------------------+
|  [ Knowledge Recovery System ]                                                  User: Asha (Admin) |
+------------------+---------------------------------------------------------------------------------+
| Dashboard        |  OVERVIEW                                                                       |
| Knowledge Library|  Dashboard                                                                      |
| Recovery Requests|                                                                                 |
| My Contributions |  [ Total Knowledge: 9 ]  [ Published: 7 ]  [ Drafts: 2 ]  [ Critical Items: 4 ] |
|                  |                                                                                 |
| ADMIN            |  +---------------------------------------------------------------------------+  |
| User Management  |  | [!] KNOWLEDGE AT RISK: 2 items need attention (Owned by departed Karthik)  |  |
| Transfer         |  +---------------------------------------------------------------------------+  |
| Audit Log        |                                                                                 |
|                  |  Recent Knowledge Table:                                                        |
| [ Sign Out ]     |  - Deploying the billing service  | Karthik S | Engineering | 5/5 | Published     |
|                  |  - Restoring nightly backup       | Karthik S | Engineering | 5/5 | Published     |
+------------------+---------------------------------------------------------------------------------+
```
*Figure 8.1: Admin Dashboard showing overall metrics, at-risk notification for departed staff, and quick status indicators.*

```
+----------------------------------------------------------------------------------------------------+
| Knowledge Library                                                            [ + Add Knowledge ]   |
| Browse and discover organizational knowledge                                                       |
|                                                                                                    |
| Search: [ "deploy billing service"                             ]   [ Mode: Semantic Search (AI) v ]|
| Filter: [ Category: All v ]   [ Status: Published v ]   [ Criticality: All v ]   [ Clear Filters ] |
|                                                                                                    |
| Results:                                                                                           |
| +------------------------------------------------------------------------------------------------+ |
| | Deployment                                                    [ Published ] [ Match: 73.3% ]    |
| | Deploying the billing service                                                                  |
| | Steps to build, tag and deploy the billing service to production...                            |
| | Owner: Karthik S | Criticality: 5/5 | Updated: 2026-11-18                                       |
| +------------------------------------------------------------------------------------------------+ |
| +------------------------------------------------------------------------------------------------+ |
| | Incident Response                                             [ Published ] [ Match: 23.5% ]    |
| | Handling a payment gateway outage                                                              |
| | Who to contact, how to switch to backup gateway, and reconcile pending payments...              |
| | Owner: Meena Iyer | Criticality: 5/5                                                           |
| +------------------------------------------------------------------------------------------------+ |
+----------------------------------------------------------------------------------------------------+
```
*Figure 8.2: Knowledge Library with Semantic Search enabled, displaying relevance score percentages derived from Qdrant Cosine distances.*

```
+----------------------------------------------------------------------------------------------------+
| Knowledge Transfer                                                             [ Back to Dashboard]|
| Move knowledge items of a departed employee to an active colleague.                                |
|                                                                                                    |
| Departed Employees:                                                                                |
| - Karthik S (karthik@example.com) — 2 item(s) still owned — departed on 2026-09-30                 |
|                                                                                                    |
| Transfer Knowledge Form:                                                                           |
| From (departed employee): [ Karthik S (2 items)                                                  v]|
| To (active employee):     [ Ravi Kumar (contributor)                                             v]|
|                                                                                                    |
| [ Transfer Knowledge Button ]                                                                      |
| -> Message: "2 item(s) transferred from Karthik S to Ravi Kumar."                                  |
| -> Database: Invokes CALL transfer_knowledge(4, 2, 1) inside an atomic transaction                 |
| -> Audit Log: Automatically records TRANSFER_KNOWLEDGE entry with actor and timestamp              |
+----------------------------------------------------------------------------------------------------+
```
*Figure 8.3: Knowledge Transfer Admin screen executing stored procedure `transfer_knowledge` with audit tracking.*

---

## 9. Evaluation Rubrics — Completion Status

| Rubric Component | Description & Requirement | Implementation Evidence | Status |
|:---|:---|:---|:---:|
| **1. Relational Schema & Constraints** | 3NF normalized schema, PK/FK relationships, domain & check constraints, cascading actions. | Implemented in `db/schema.sql` across 8 tables; constraints on roles, status, dates, and ratings; cascade delete on tags/versions. | **100% Complete** |
| **2. Advanced SQL (Procedures & Functions)** | Meaningful stored procedures and functions performing multi-step business logic. | `transfer_knowledge(from, to, actor)` procedure with state validation and atomic reassignments; `fn_risk_score(user)` function. | **100% Complete** |
| **3. Database Triggers** | `BEFORE` and `AFTER` triggers capturing revisions and business events. | `item_versioning` trigger (retains full historical diffs on body update); `audit_departure` trigger; `audit_archive` trigger. | **100% Complete** |
| **4. Database Security & Access Control** | Dedicated roles, least-privilege model, and database-enforced Row-Level Security (RLS). | Roles `kr_admin`, `kr_contributor`, `kr_viewer`; RLS policies on `knowledge_item` preventing unauthorized draft or item leakage. | **100% Complete** |
| **5. NoSQL / Vector Database Integration** | Vector storage, embedding pipeline, and similarity search over unstructured content. | Qdrant Cloud collection `knowledge_chunks` (384 dimensions, Cosine distance) with real-time vector synchronization on create/update/archive. | **100% Complete** |
| **6. Full-Stack Web Application** | Functional interactive UI integrating relational DB, vector DB, and authentication. | Next.js 16 (App Router), React 19, NextAuth.js JWT authentication, 10 dynamic views for admins, contributors, and viewers. | **100% Complete** |
| **7. Semantic Search Integration** | End-to-end semantic search query flow with similarity metrics and security checks. | `GET /api/search` queries Qdrant vectors and re-evaluates results via PostgreSQL RLS before presenting in frontend. | **100% Complete** |
| **8. Audit Trail & Compliance** | Immutable audit records for administrative, departure, and transfer events. | `audit_log` table populated by system triggers and stored procedures; `/audit-log` viewer with action filters. | **100% Complete** |
| **9. Code Quality & Build Verification** | Production build passes without runtime crashes or syntax errors. | `npm run build` succeeds cleanly (`exit code 0`); TypeScript/Turbopack verification complete. | **100% Complete** |

---
*Report prepared for submission to Department of Computer Science and Engineering, PES University.*
