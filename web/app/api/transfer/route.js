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

// GET: departed users (with item counts), active users who can receive items,
// and prioritized knowledge tasks owned by departed users
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

        const items = await client.query(`
          SELECT
            k.item_id,
            k.owner_id,
            k.title,
            k.criticality,
            k.status,
            COALESCE(c.name, 'Uncategorized') AS category_name,
            (6 - k.criticality) AS priority_rank,
            CASE k.criticality
              WHEN 5 THEN 'Priority 1 (Urgent - Transfer First)'
              WHEN 4 THEN 'Priority 2 (High Priority)'
              WHEN 3 THEN 'Priority 3 (Medium Priority)'
              WHEN 2 THEN 'Priority 4 (Low Priority)'
              ELSE 'Priority 5 (Routine)'
            END AS priority_label
          FROM knowledge_item k
          JOIN app_user u ON u.user_id = k.owner_id
          LEFT JOIN category c ON c.category_id = k.category_id
          WHERE u.status = 'departed' AND k.status <> 'archived'
          ORDER BY k.criticality DESC, k.item_id ASC
        `);

        return {
          departed: departed.rows,
          targets: targets.rows,
          items: items.rows,
        };
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

// POST: run the transfer (single prioritized item OR full transfer via stored procedure)
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
    const itemId = body.itemId ? Number(body.itemId) : null;

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
        if (itemId) {
          // Transfer a single specific prioritized item
          const itemRes = await client.query(
            `SELECT item_id, title, criticality, owner_id
             FROM knowledge_item
             WHERE item_id = $1 AND owner_id = $2 AND status <> 'archived'`,
            [itemId, fromUserId]
          );

          if (itemRes.rows.length === 0) {
            throw new Error('Knowledge task not found or already transferred.');
          }

          const item = itemRes.rows[0];
          const rank = 6 - item.criticality;

          await client.query(
            `UPDATE knowledge_item SET owner_id = $1, updated_at = now() WHERE item_id = $2`,
            [toUserId, itemId]
          );

          await client.query(
            `INSERT INTO audit_log (actor_id, action, target_table, target_id, details)
             VALUES ($1, 'TRANSFER_KNOWLEDGE', 'knowledge_item', $2, $3)`,
            [
              Number(token.id),
              itemId,
              `Priority ${rank} task "${item.title}" transferred from user #${fromUserId} to user #${toUserId}`,
            ]
          );

          return {
            moved: 1,
            itemTitle: item.title,
            priorityRank: rank,
          };
        } else {
          // Batch transfer all items from the departed user using stored procedure
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
      }
    );

    return Response.json({
      message: itemId
        ? `Priority ${result.priorityRank} task "${result.itemTitle}" transferred successfully.`
        : 'Knowledge transferred successfully.',
      moved: result.moved,
    });
  } catch (error) {
    // The procedure raises its own messages (for example, source not departed)
    if (error.code === 'P0001') {
      return Response.json({ error: error.message }, { status: 400 });
    }

    console.error('Transfer POST error:', error);

    return Response.json(
      { error: error.message || 'Unable to transfer knowledge.' },
      { status: 500 }
    );
  }
}
