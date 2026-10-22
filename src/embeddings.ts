/**
 * Pluggable embedding backend.
 *
 * If OPENAI_API_KEY is set, uses OpenAI's text-embedding-3-small (1536 dims).
 * Otherwise falls back to a deterministic local hashing embedding so the
 * server is fully usable offline for evaluation — swap in a real model
 * (OpenAI, Cohere, or a local model via Ollama) for production-quality search.
 */

export const EMBEDDING_DIMENSIONS = 1536;

export async function embed(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    return embedWithOpenAI(text, apiKey);
  }
  return embedLocalFallback(text);
}

async function embedWithOpenAI(text: string, apiKey: string): Promise<number[]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI embeddings request failed (${res.status}): ${body}`);
  }

  const json = (await res.json()) as { data: { embedding: number[] }[] };
  return json.data[0].embedding;
}

/** Deterministic bag-of-words hashing embedding. Not semantically rich, but
 * stable, dependency-free, and good enough to exercise the full pipeline. */
function embedLocalFallback(text: string): number[] {
  const vector = new Array(EMBEDDING_DIMENSIONS).fill(0);
  const words = text.toLowerCase().match(/[a-z0-9çğıöşü]+/giu) ?? [];

  for (const word of words) {
    const hash = simpleHash(word);
    const index = hash % EMBEDDING_DIMENSIONS;
    vector[index] += 1;
  }

  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vector.map((v) => v / norm);
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}
