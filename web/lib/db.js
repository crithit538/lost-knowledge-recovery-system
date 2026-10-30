
import { Pool } from 'pg';

// Create one PostgreSQL connection pool for the application.
const pool =
  globalThis.pgPool ||
  new Pool({
    connectionString: process.env.DATABASE_URL,
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.pgPool = pool;
}

// Only allow these predefined database roles.
const allowedRoles = {
  admin: 'kr_admin',
  contributor: 'kr_contributor',
  viewer: 'kr_viewer',
};

// Run database operations using the requested role
// and the logged-in user's ID.
export async function withRole(userId, role, callback) {
  const dbRole = allowedRoles[role];

  if (!dbRole) {
    throw new Error('Invalid database role');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Role is selected only from the fixed allowlist above.
    await client.query(`SET LOCAL ROLE ${dbRole}`);

    // Store the user ID for PostgreSQL row-level security.
    await client.query(
      "SELECT set_config('app.user_id', $1, true)",
      [String(userId)]
    );

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

export default pool;
