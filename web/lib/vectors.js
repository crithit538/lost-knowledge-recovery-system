import { qdrant, COLLECTION_NAME } from '@/lib/qdrant';
import { generateEmbedding } from '@/lib/embeddings';

// Returns [{ itemId, score }], best match first.
export async function searchVectors(queryText, limit = 10) {
  const query = String(queryText ?? '').trim();

  if (!query) return [];

  const vector = await generateEmbedding(query);

  const response = await qdrant.query(COLLECTION_NAME, {
  query: vector,
  limit: Math.max(1, Number(limit) || 10),
  with_payload: true,
});

const results = response.points ?? [];

return results
    .map((point) => ({
      itemId: Number(point.payload?.item_id),
      score: Number(point.score),
    }))
    .filter(
      (match) =>
        Number.isSafeInteger(match.itemId) &&
        Number.isFinite(match.score)
    )
    .sort((a, b) => b.score - a.score);
}

// Embed title and body and store the vector in Qdrant.
export async function upsertItemVector(item) {
  if (!item || !Number.isSafeInteger(Number(item.item_id))) {
    throw new Error('A valid item_id is required for vector upsert.');
  }

  const itemId = Number(item.item_id);
  const text = `${item.title ?? ''}\n${item.body ?? ''}`.trim();

  if (!text) {
    throw new Error(`Item ${itemId} has no text to embed.`);
  }

  const vector = await generateEmbedding(text);

  await qdrant.upsert(COLLECTION_NAME, {
    wait: true,
    points: [
      {
        id: itemId,
        vector,
        payload: {
          item_id: itemId,
          title: item.title ?? '',
          dept_id: item.dept_id ?? null,
          category_id: item.category_id ?? null,
        },
      },
    ],
  });
}

// Remove the vector for a draft, archived, or deleted item.
export async function deleteItemVector(itemId) {
  const id = Number(itemId);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error('A valid item ID is required for vector deletion.');
  }

  await qdrant.delete(COLLECTION_NAME, {
    wait: true,
    points: [id],
  });
}