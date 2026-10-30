
import { getToken } from 'next-auth/jwt';
import { withRole } from '@/lib/db';

async function getAuthenticatedToken(request) {
  return getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    cookieName: 'next-auth.session-token',
  });
}

// GET: Fetch recovery requests


// GET: Fetch recovery requests
export async function GET(request) {
  try {
    const token = await getAuthenticatedToken(request);

    if (!token?.id || !token?.role) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const data = await withRole(
      token.id,
      token.role,
      async (client) => {
        const result = await client.query(`
          SELECT
            request_id,
            requester_id,
            item_id,
            assigned_to,
            topic,
            details,
            status,
            created_at,
            resolved_at
          FROM recovery_request
          ORDER BY created_at DESC
        `);

        let contributors = [];

        if (token.role === 'admin') {
          const users = await client.query(`
            SELECT user_id, full_name
            FROM app_user
            WHERE status = 'active'
              AND role = 'contributor'
            ORDER BY full_name
          `);

          contributors = users.rows;
        }

        return {
          requests: result.rows,
          contributors,
        };
      }
    );

    return Response.json(data);
  } catch (error) {
    console.error('Recovery requests GET error:', error);

    return Response.json(
      { error: 'Unable to load recovery requests.' },
      { status: 500 }
    );
  }
}



// POST: Submit a new recovery request
export async function POST(request) {
  try {
    const token = await getAuthenticatedToken(request);

    if (!token?.id || !token?.role) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();

    const topic = typeof body.topic === 'string'
      ? body.topic.trim()
      : '';

    const details = typeof body.details === 'string'
      ? body.details.trim()
      : '';

    const itemId =
      body.itemId === null ||
      body.itemId === undefined ||
      body.itemId === ''
        ? null
        : Number(body.itemId);

    if (!topic) {
      return Response.json(
        { error: 'Please enter a request topic.' },
        { status: 400 }
      );
    }

    if (topic.length > 255 || details.length > 5000) {
      return Response.json(
        { error: 'Topic or details exceed the allowed length.' },
        { status: 400 }
      );
    }

    if (
      itemId !== null &&
      (!Number.isInteger(itemId) || itemId <= 0)
    ) {
      return Response.json(
        { error: 'Invalid knowledge item.' },
        { status: 400 }
      );
    }

    const result = await withRole(
      token.id,
      token.role,
      async (client) => {
        const inserted = await client.query(
          `INSERT INTO recovery_request
            (requester_id, item_id, topic, details)
           VALUES ($1, $2, $3, $4)
           RETURNING request_id, requester_id, item_id,
                     topic, details, status, created_at`,
          [Number(token.id), itemId, topic, details || null]
        );

        return inserted.rows[0];
      }
    );

    return Response.json(
      {
        message: 'Recovery request submitted successfully.',
        request: result,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Recovery request POST error:', error);

    return Response.json(
      { error: 'Unable to submit recovery request.' },
      { status: 500 }
    );
  }
}
