import { getToken } from 'next-auth/jwt';
import { withRole } from '@/lib/db';

async function getAdminToken(request) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    cookieName: 'next-auth.session-token',
  });

  if (!token?.id || token.role !== 'admin') return null;
  return token;
}

// GET: departed users (with item counts) and active users who can receive items
export async function GET(request) {
  try {
    const token = await getAdminToken(request);

    if (!token) {
      return Response.json(
        { error: 'Admin access required.' },
        { status: 403 }
      );
    }

    const data = await withRole(
      token.id,
      token.role,
      async (client) => {
        const departed = await client.query(`
          SELECT
            u.user_id,
            u.full_name,
            u.email,
            u.departed_on,
            (COUNT(k.item_id) FILTER (WHERE k.status <> 'archived'))::int
              AS item_count
          FROM app_user u
          LEFT JOIN knowledge_item k ON k.owner_id = u.user_id
          WHERE u.status = 'departed'
          GROUP BY u.user_id, u.full_name, u.email, u.departed_on
          ORDER BY u.full_name
        `);

        const targets = await client.query(`
          SELECT user_id, full_name, role
          FROM app_user
          WHERE status = 'active'
            AND role IN ('contributor', 'admin')
          ORDER BY full_name
        `);

        return { departed: departed.rows, targets: targets.rows };
      }
    );

    return Response.json(data);
  } catch (error) {
    console.error('Transfer GET error:', error);

    return Response.json(
      { error: 'Unable to load transfer data.' },
      { status: 500 }
    );
  }
}

// POST: run the transfer_knowledge stored procedure
export async function POST(request) {
  try {
    const token = await getAdminToken(request);

    if (!token) {
      return Response.json(
        { error: 'Admin access required.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const fromUserId = Number(body.fromUserId);
    const toUserId = Number(body.toUserId);

    if (
      !Number.isInteger(fromUserId) ||
      !Number.isInteger(toUserId) ||
      fromUserId <= 0 ||
      toUserId <= 0
    ) {
      return Response.json(
        { error: 'Please choose both users.' },
        { status: 400 }
      );
    }

    if (fromUserId === toUserId) {
      return Response.json(
        { error: 'Source and receiving user must be different.' },
        { status: 400 }
      );
    }

    const result = await withRole(
      token.id,
      token.role,
      async (client) => {
        const before = await client.query(
          `SELECT COUNT(*)::int AS n
           FROM knowledge_item
           WHERE owner_id = $1 AND status <> 'archived'`,
          [fromUserId]
        );

        await client.query(
          'CALL transfer_knowledge($1::int, $2::int, $3::int)',
          [fromUserId, toUserId, Number(token.id)]
        );

        return { moved: before.rows[0].n };
      }
    );

    return Response.json({
      message: 'Knowledge transferred successfully.',
      moved: result.moved,
    });
  } catch (error) {
    // The procedure raises its own messages (for example, source not departed)
    if (error.code === 'P0001') {
      return Response.json({ error: error.message }, { status: 400 });
    }

    console.error('Transfer POST error:', error);

    return Response.json(
      { error: 'Unable to transfer knowledge.' },
      { status: 500 }
    );
  }
}