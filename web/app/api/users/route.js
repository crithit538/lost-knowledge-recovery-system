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

    const users = await withRole(
      token.id,
      token.role,
      async (client) => {
        const result = await client.query(`
          SELECT
            u.user_id,
            u.full_name,
            u.email,
            u.role,
            u.status,
            u.departed_on,
            d.name AS department
          FROM app_user u
          LEFT JOIN department d ON d.dept_id = u.dept_id
          ORDER BY u.user_id
        `);

        return result.rows;
      }
    );

    return Response.json({ users });
  } catch (error) {
    console.error('Users API error:', error);

    return Response.json(
      { error: 'Unable to load users.' },
      { status: 500 }
    );
  }
}
export async function PATCH(request) {
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

    const body = await request.json();
    const userId = Number(body.userId);
    const action = body.action;

    if (!Number.isInteger(userId) || userId <= 0) {
      return Response.json(
        { error: 'Invalid user ID.' },
        { status: 400 }
      );
    }

    if (!['depart', 'reactivate'].includes(action)) {
      return Response.json(
        { error: 'Invalid action.' },
        { status: 400 }
      );
    }

    if (userId === Number(token.id)) {
      return Response.json(
        { error: 'You cannot change your own account status.' },
        { status: 400 }
      );
    }

    const updated = await withRole(
      token.id,
      token.role,
      async (client) => {
        const result = await client.query(
          `UPDATE app_user
 SET status = $1::varchar,
     departed_on = CASE
       WHEN $1::varchar = 'departed' THEN CURRENT_DATE
       ELSE NULL
     END
 WHERE user_id = $2
 RETURNING user_id, full_name, status, departed_on`,
          [
            action === 'depart' ? 'departed' : 'active',
            userId,
          ]
        );

        return result.rows[0] || null;
      }
    );

    if (!updated) {
      return Response.json(
        { error: 'User not found.' },
        { status: 404 }
      );
    }

    return Response.json({
      message: 'User status updated successfully.',
      user: updated,
    });
  } catch (error) {
    console.error('User update API error:', error);

    return Response.json(
      { error: 'Unable to update user status.' },
      { status: 500 }
    );
  }
}