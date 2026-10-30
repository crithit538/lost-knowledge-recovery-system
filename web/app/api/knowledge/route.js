
import { getToken } from 'next-auth/jwt';
import { withRole } from '@/lib/db';

export async function GET(request) {
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

    const { searchParams } = new URL(request.url);

    const search = searchParams.get('search')?.trim() || '';
    const category = searchParams.get('category') || '';
    const status = searchParams.get('status') || '';
    const criticality = searchParams.get('criticality') || '';
    const mine = searchParams.get('mine') === 'true';

    const result = await withRole(
      token.id,
      token.role,
      async (client) => {
        const query = `
          SELECT
            k.item_id,
            k.title,
            k.criticality,
            k.status,
            k.updated_at,
            u.full_name AS owner,
            c.name AS category
          FROM knowledge_item k
          LEFT JOIN app_user u ON u.user_id = k.owner_id
          LEFT JOIN category c ON c.category_id = k.category_id
          WHERE
  ($1 = '' OR k.title ILIKE '%' || $1 || '%'
   OR k.body ILIKE '%' || $1 || '%')
  AND ($2 = '' OR c.name = $2)
  AND ($3 = '' OR k.status = $3)
  AND ($4 = '' OR k.criticality = $4::int)
  AND (NOT $5 OR k.owner_id = $6)
          ORDER BY k.updated_at DESC NULLS LAST, k.created_at DESC
        `;

        const items = await client.query(query, [
  search,
  category,
  status,
  criticality,
  mine,
  Number(token.id),
]);

        const categories = await client.query(`
          SELECT DISTINCT name
          FROM category
          ORDER BY name
        `);

        return {
          items: items.rows,
          categories: categories.rows.map((row) => row.name),
        };
      }
    );

    return Response.json(result);
  } catch (error) {
    console.error('Knowledge Library API error:', error);

    return Response.json(
      { error: 'Unable to load knowledge items.' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
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
        { error: 'You do not have permission to create knowledge items.' },
        { status: 403 }
      );
    }

    const body = await request.json();

    const title = typeof body.title === 'string'
      ? body.title.trim()
      : '';

    const content = typeof body.body === 'string'
      ? body.body.trim()
      : '';

    const categoryName = typeof body.categoryId === 'string'
  ? body.categoryId.trim()
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

    
    const result = await withRole(
      token.id,
      token.role,
      async (client) => {
        let categoryId = null;

if (categoryName) {
  const category = await client.query(
    'SELECT category_id FROM category WHERE name = $1',
    [categoryName]
  );

  if (category.rowCount === 0) {
    throw new Error('Invalid category.');
  }

  categoryId = category.rows[0].category_id;
}
         const inserted = await client.query(
          `INSERT INTO knowledge_item
            (owner_id, category_id, title, body, criticality, status)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [
            Number(token.id),
            categoryId,
            title,
            content,
            criticality,
            itemStatus,
          ]
        );

        return inserted.rows[0];
      }
    );

    return Response.json(
      {
        message: 'Knowledge item created successfully.',
        item: result,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Knowledge creation API error:', error);

    return Response.json(
      { error: 'Unable to create knowledge item.' },
      { status: 500 }
    );
  }
}

