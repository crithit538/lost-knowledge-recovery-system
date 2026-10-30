# Lost Knowledge Recovery System — Web Application

## Overview
Next.js web application for managing organizational knowledge, recovery requests, user access and knowledge contributions.

## Tech Stack
- Next.js 16
- React 19
- PostgreSQL
- NextAuth.js
- Qdrant Cloud
- Hugging Face Transformers (`all-MiniLM-L6-v2`)

## Prerequisites
- Node.js and npm
- PostgreSQL database configured using the root `db/` scripts
- Qdrant Cloud cluster

## Setup

1. Navigate to the `web` directory.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env.local` file in the `web` directory with:

   ```env
   DATABASE_URL=your_postgresql_connection_string
   NEXTAUTH_SECRET=your_generated_secret
   QDRANT_URL=your_qdrant_cluster_url
   QDRANT_API_KEY=your_qdrant_api_key
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open http://localhost:3000.

## Existing Test Accounts

All seeded accounts use the test password `Password@123`.

- Admin: `asha@example.com`
- Contributor: `ravi@example.com`
- Viewer: `divya@example.com`

Do not use these test credentials in production.

## Important Existing Helpers and Files

### Authentication
- `lib/authOptions.js` — NextAuth credentials authentication and JWT/session configuration.
- `app/api/auth/[...nextauth]/route.js` — NextAuth API route.
- `app/providers.js` — SessionProvider wrapper.
- `app/layout.js` — Root application layout.

### Database
- `lib/db.js` — PostgreSQL connection pool and `withRole(userId, role, callback)` helper.
- `withRole` starts a transaction, switches to the allowlisted database role using `SET LOCAL ROLE`, sets the application user ID and executes the callback.

### Qdrant
- `lib/qdrant.js` — Qdrant client and collection name.
- `lib/embeddings.js` — Local text embedding generation.

## Development Notes
- Keep `.env.local` private. Never commit credentials or API keys.
- Protected API routes use the authenticated NextAuth JWT.
- Next.js dynamic route parameters should be awaited.
- Use the existing `withRole` helper for database operations that require role-based access.
