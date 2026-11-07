import { getToken } from 'next-auth/jwt';
import { withRole } from '@/lib/db';
import { searchVectors } from '@/lib/vectors';

export async function GET(request) {
  try {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
      cookieName: 'next-auth.session-token',
    });

    if (!token?.id || !token?.role) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();

    if (!q) {
      return Response.json(
        { error: 'Please enter a search term.' },
        { status: 400 }
      );
    }

    if (q.length > 200) {
      return Response.json(
        { error: 'Search term is too long.' },
        { status: 400 }
      );
    }

    const matches = await searchVectors(q, 10);

    if (matches.length === 0) {
      return Response.json({ results: [] });
    }

    const ids = matches.map((match) => match.itemId);

    // Reload through the user's own role so row-level security applies.
    const items = await withRole(
      token.id,
      token.role,
      async (client) => {
        const result = await client.query(
          `SELECT
             k.item_id,
             k.title,
             k.criticality,
             k.status,
             c.name AS category,
             u.full_name AS owner,
             LEFT(k.body, 200) AS snippet
           FROM knowledge_item k
           LEFT JOIN category c ON c.category_id = k.category_id
           LEFT JOIN app_user u ON u.user_id = k.owner_id
           WHERE k.item_id = ANY($1::int[])`,
          [ids]
        );
        return result.rows;
      }
    );

    const byId = new Map(items.map((item) => [item.item_id, item]));

    const results = matches
      .filter((match) => byId.has(match.itemId))
      .map((match) => ({ ...byId.get(match.itemId), score: match.score }));

    return Response.json({ results });
  } catch (error) {
    console.error('Search API error:', error);

    return Response.json(
      { error: 'Unable to search knowledge.' },
      { status: 500 }
    );
  }
}