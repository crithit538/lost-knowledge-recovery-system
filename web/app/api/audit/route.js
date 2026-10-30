import { getToken } from 'next-auth/jwt';
import { withRole } from '@/lib/db';

export async function GET(request) {
  try {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
      cookieName: 'next-auth.session-token',
    });

    if (!token?.id || token.role !== 'admin') {
      return Response.json(
        { error: 'Admin access required.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    const data = await withRole(
      token.id,
      token.role,
      async (client) => {
        const logs = await client.query(
          `SELECT
             a.log_id,
             a.actor_id,
             u.full_name AS actor_name,
             a.action,
             a.target_table,
             a.target_id,
             a.details,
             a.logged_at
           FROM audit_log a
           LEFT JOIN app_user u ON u.user_id = a.actor_id
           WHERE ($1::text IS NULL OR a.action = $1::text)
           ORDER BY a.logged_at DESC, a.log_id DESC
           LIMIT 200`,
          [action || null]
        );

        const actions = await client.query(
          `SELECT DISTINCT action FROM audit_log ORDER BY action`
        );

        return {
          logs: logs.rows,
          actions: actions.rows.map((row) => row.action),
        };
      }
    );

    return Response.json(data);
  } catch (error) {
    console.error('Audit log API error:', error);

    return Response.json(
      { error: 'Unable to load audit log.' },
      { status: 500 }
    );
  }
}