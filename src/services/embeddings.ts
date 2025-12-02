/**
 * Embedding generation service
 *
 * IMPORTANT: This service must use the SAME embedding model that Kura uses
 * to index notes. Otherwise, semantic search will not work correctly.
 *
 * Common embedding models:
 * - OpenAI text-embedding-3-small (1536 dimensions)
 * - OpenAI text-embedding-3-large (3072 dimensions)
 * - OpenAI text-embedding-ada-002 (1536 dimensions)
 * - Sentence Transformers (various dimensions)
 *
 * Configure the embedding provider based on your Kura setup.
 */

/**
 * Custom error for embedding generation failures
 */
export class EmbeddingError extends Error {
  constructor(message: string, public override cause?: unknown) {
    super(message);
    this.name = 'EmbeddingError';
  }
}

/**
 * Generate embedding vector for a text query
 *
 * This is a placeholder implementation. You must configure it to match
 * the embedding model used by Kura for indexing notes.
 *
 * @param text - Text to generate embedding for
 * @returns Vector embedding (array of numbers)
 * @throws {EmbeddingError} If embedding generation fails
 *
 * @example
 * // Using OpenAI (if Kura uses OpenAI embeddings)
 * const embedding = await generateEmbedding("machine learning algorithms");
 *
 * @example
 * // Using local model (if Kura uses local embeddings)
 * const embedding = await generateEmbedding("docker deployment guide");
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  // Validate input
  if (!text || text.trim().length === 0) {
    throw new EmbeddingError('Text cannot be empty');
  }

  try {
    // TODO: Replace with actual embedding generation
    // This is a placeholder that returns a dummy embedding
    //
    // Implementation options:
    //
    // 1. OpenAI API:
    //    const response = await openai.embeddings.create({
    //      model: 'text-embedding-3-small',
    //      input: text,
    //    });
    //    return response.data[0].embedding;
    //
    // 2. Local model (e.g., Sentence Transformers):
    //    const embedding = await localModel.encode(text);
    //    return Array.from(embedding);
    //
    // 3. External API:
    //    const response = await fetch('https://embedding-api.example.com/embed', {
    //      method: 'POST',
    //      headers: { 'Content-Type': 'application/json' },
    //      body: JSON.stringify({ text }),
    //    });
    //    const data = await response.json();
    //    return data.embedding;

    // For now, throw an error to indicate this needs implementation
    throw new EmbeddingError(
      'Embedding generation not configured. Please implement generateEmbedding() ' +
        'to match your Kura embedding model. See comments in src/services/embeddings.ts'
    );

    // Dummy return to satisfy TypeScript (unreachable due to throw above)
    // return new Array(1536).fill(0);
  } catch (error) {
    if (error instanceof EmbeddingError) {
      throw error;
    }
    throw new EmbeddingError('Failed to generate embedding', error);
  }
}

/**
 * Batch generate embeddings for multiple texts
 *
 * More efficient than calling generateEmbedding() multiple times
 * for some embedding providers (e.g., OpenAI batch API)
 *
 * @param texts - Array of texts to generate embeddings for
 * @returns Array of vector embeddings
 */
export async function generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  // TODO: Implement batch embedding generation for efficiency
  // For now, generate one at a time
  return Promise.all(texts.map((text) => generateEmbedding(text)));
}
