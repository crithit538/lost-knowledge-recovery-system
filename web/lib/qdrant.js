import { QdrantClient } from '@qdrant/js-client-rest';

const globalForQdrant = globalThis;

export const qdrant =
  globalForQdrant.qdrantClient ||
  new QdrantClient({
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForQdrant.qdrantClient = qdrant;
}

export const COLLECTION_NAME = 'knowledge_chunks';