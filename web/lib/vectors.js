import { withRole } from '@/lib/db';

// TEMPORARY stand-in until the real Qdrant code is ready.
// The real version keeps the same function names, arguments and return shapes.

// Returns [{ itemId, score }], best match first.
export async function searchVectors(queryText, limit = 10) {
  const words = queryText
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 2);

  if (words.length === 0) return [];

  const patterns = words.map((word) => `%${word}%`);

  // Only item ids come from here. The search route reloads the items
  // through the logged-in user's role, so row-level security still applies.
  const rows = await withRole(1, 'admin', async (client) => {
    const result = await client.query(
      `SELECT item_id
       FROM knowledge_item
       WHERE status = 'published'
         AND (title ILIKE ANY($1::text[]) OR body ILIKE ANY($1::text[]))
       LIMIT $2`,
      [patterns, limit]
    );
    return result.rows;
  });

  return rows.map((row, index) => ({
    itemId: row.item_id,
    score: 1 - index * 0.01,
  }));
}

// Embed title and body and store the vector (real version talks to Qdrant).
export async function upsertItemVector(item) {
  console.log('[vectors stub] upsert item', item?.item_id);
}

// Remove the vector for an archived or deleted item.
export async function deleteItemVector(itemId) {
  console.log('[vectors stub] delete item', itemId);
}