import { getToken } from 'next-auth/jwt';
import { withRole } from '@/lib/db';

export async function GET(request) {
  try {
    const token = await getToken({
  req: request,
  secret: process.env.NEXTAUTH_SECRET,
  cookieName: 'next-auth.session-token',
});

    console.log('Dashboard token found:', !!token);

    if (!token?.id || !token?.role) {
      return Response.json(
        { error: 'Unauthorized', tokenFound: !!token },
        { status: 401 }
      );
    }

    const data = await withRole(
      token.id,
      token.role,
      async (client) => {
        const statsResult = await client.query(`
          SELECT
            COUNT(*)::int AS total_items,
            COUNT(*) FILTER (WHERE status = 'published')::int AS published_items,
            COUNT(*) FILTER (WHERE status = 'draft')::int AS draft_items,
            COUNT(*) FILTER (
              WHERE criticality >= 4 AND status <> 'archived'
            )::int AS critical_items
          FROM knowledge_item
        `);

        const recentResult = await client.query(`
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
          ORDER BY k.updated_at DESC NULLS LAST, k.created_at DESC
          LIMIT 5
        `);

        let atRiskCount = null;

        if (token.role === 'admin') {
          const riskResult = await client.query(`
            SELECT COUNT(*)::int AS count
            FROM knowledge_item k
            JOIN app_user u ON u.user_id = k.owner_id
            WHERE u.status = 'departed'
              AND k.status <> 'archived'
          `);

          atRiskCount = riskResult.rows[0].count;
        }

        return {
          stats: statsResult.rows[0],
          recentItems: recentResult.rows,
          atRiskCount,
        };
      }
    );

    return Response.json({
      user: {
        name: token.name,
        role: token.role,
      },
      ...data,
    });
  } catch (error) {
    console.error('Dashboard API error:', error);

    return Response.json(
      { error: 'Unable to load dashboard data.' },
      { status: 500 }
    );
  }
}