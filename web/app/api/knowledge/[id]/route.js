
import { getToken } from 'next-auth/jwt';
import { withRole } from '@/lib/db';

export async function GET(request, context) {
  try {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
      cookieName: 'next-auth.session-token',
    });

    if (!token?.id || !token?.role) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const itemId = Number(id);

    if (!Number.isInteger(itemId) || itemId <= 0) {
      return Response.json(
        { error: 'Invalid knowledge item ID.' },
        { status: 400 }
      );
    }

    const data = await withRole(
      token.id,
      token.role,
      async (client) => {
        const itemResult = await client.query(
          `
          SELECT
            k.item_id,
            k.title,
            k.body,
            k.criticality,
            k.status,
            k.created_at,
            k.updated_at,
            u.full_name AS owner,
            c.name AS category
          FROM knowledge_item k
          LEFT JOIN app_user u ON u.user_id = k.owner_id
          LEFT JOIN category c ON c.category_id = k.category_id
          WHERE k.item_id = $1
          `,
          [itemId]
        );

        if (itemResult.rows.length === 0) {
          return null;
        }

        const versionsResult = await client.query(
          `
          SELECT version_id, version_no, body, edited_at
          FROM item_version
          WHERE item_id = $1
          ORDER BY version_no DESC
          `,
          [itemId]
        );

        return {
          item: itemResult.rows[0],
          versions: versionsResult.rows,
        };
      }
    );

    if (!data) {
      return Response.json(
        { error: 'Knowledge item not found or not accessible.' },
        { status: 404 }
      );
    }

    return Response.json(data);
  } catch (error) {
    console.error('Knowledge detail API error:', error);

    return Response.json(
      { error: 'Unable to load knowledge item.' },
      { status: 500 }
    );
  }
}
export async function PATCH(request, context) {
  try {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
      cookieName: 'next-auth.session-token',
    });

    if (!token?.id || !token?.role) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!['admin', 'contributor'].includes(token.role)) {
      return Response.json(
        { error: 'You do not have permission to edit knowledge items.' },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const itemId = Number(id);

    if (!Number.isInteger(itemId) || itemId <= 0) {
      return Response.json(
        { error: 'Invalid knowledge item ID.' },
        { status: 400 }
      );
    }

    const body = await request.json();

    const title = typeof body.title === 'string'
      ? body.title.trim()
      : '';

    const content = typeof body.body === 'string'
      ? body.body.trim()
      : '';

    const categoryName = typeof body.category === 'string'
      ? body.category.trim()
      : '';

    const criticality = Number(body.criticality);
    const itemStatus = body.status;

    if (!title || !content) {
      return Response.json(
        { error: 'Title and content are required.' },
        { status: 400 }
      );
    }

    if (title.length > 255 || content.length > 50000) {
      return Response.json(
        { error: 'Title or content exceeds the allowed length.' },
        { status: 400 }
      );
    }

    if (!Number.isInteger(criticality) ||
        criticality < 1 || criticality > 5) {
      return Response.json(
        { error: 'Criticality must be between 1 and 5.' },
        { status: 400 }
      );
    }

    if (!['draft', 'published'].includes(itemStatus)) {
      return Response.json(
        { error: 'Invalid knowledge item status.' },
        { status: 400 }
      );
    }

    const updated = await withRole(
      token.id,
      token.role,
      async (client) => {
        let categoryId = null;

        if (categoryName) {
          const categoryResult = await client.query(
            'SELECT category_id FROM category WHERE name = $1',
            [categoryName]
          );

          if (categoryResult.rowCount === 0) {
            throw new Error('Invalid category.');
          }

          categoryId = categoryResult.rows[0].category_id;
        }

        const result = await client.query(
          `UPDATE knowledge_item
           SET title = $1,
               body = $2,
               category_id = $3,
               criticality = $4,
               status = $5
           WHERE item_id = $6
           RETURNING item_id, title, body, category_id,
                     criticality, status, updated_at`,
          [
            title,
            content,
            categoryId,
            criticality,
            itemStatus,
            itemId,
          ]
        );

        return result.rows[0] || null;
      }
    );

    if (!updated) {
      return Response.json(
        { error: 'Item not found or you cannot edit it.' },
        { status: 404 }
      );
    }

    return Response.json({
      message: 'Knowledge item updated successfully.',
      item: updated,
    });
  } catch (error) {
    console.error('Knowledge update API error:', error);

    return Response.json(
      { error: 'Unable to update knowledge item.' },
      { status: 500 }
    );
  }
}
