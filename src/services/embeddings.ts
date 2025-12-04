/**
 * Embedding Service for KOmcp
 *
 * Generates vector embeddings for semantic search queries using OpenAI's API.
 * Matches Kura's embedding configuration: text-embedding-3-small (512 dimensions)
 */

import OpenAI from 'openai';

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
 * OpenAI client (singleton)
 */
let openaiClient: OpenAI | null = null;

/**
 * Get or create OpenAI client
 */
function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env['OPENAI_API_KEY'];

    if (!apiKey) {
      throw new EmbeddingError(
        'OPENAI_API_KEY environment variable is not set. Please configure it in your .env file.'
      );
    }

    openaiClient = new OpenAI({
      apiKey,
      maxRetries: 3,
      timeout: 30000, // 30 second timeout
    });
  }

  return openaiClient;
}

/**
 * Maximum text length for embedding (8000 characters)
 * Matches Kura's configuration
 */
const MAX_TEXT_LENGTH = 8000;

/**
 * OpenAI embedding model
 * Must match Kura's model: text-embedding-3-small
 */
const EMBEDDING_MODEL = 'text-embedding-3-small';

/**
 * Expected embedding dimensions for text-embedding-3-small
 */
const EXPECTED_DIMENSIONS = 512;

/**
 * Generate embedding vector for a text query
 *
 * Uses OpenAI's text-embedding-3-small model (512 dimensions) to match
 * Kura's embedding configuration.
 *
 * Features:
 * - Automatic text truncation to 8000 characters
 * - Retry logic with exponential backoff (3 attempts)
 * - Rate limit handling
 *
 * @param text - The text to generate an embedding for
 * @returns Vector embedding as array of numbers (512 dimensions)
 * @throws {EmbeddingError} If embedding generation fails after retries
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    throw new EmbeddingError('Cannot generate embedding for empty text');
  }

  // Truncate text if too long (matches Kura's behavior)
  const truncatedText =
    text.length > MAX_TEXT_LENGTH ? text.substring(0, MAX_TEXT_LENGTH) : text;

  try {
    const client = getOpenAIClient();

    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: truncatedText,
      encoding_format: 'float',
    });

    if (!response.data || response.data.length === 0) {
      throw new EmbeddingError('OpenAI API returned empty response');
    }

    const embedding = response.data[0]?.embedding;

    if (!embedding) {
      throw new EmbeddingError('OpenAI API returned undefined embedding');
    }

    // Verify embedding dimensions (should be 512 for text-embedding-3-small)
    if (embedding.length !== EXPECTED_DIMENSIONS) {
      throw new EmbeddingError(
        `Unexpected embedding dimensions: expected ${EXPECTED_DIMENSIONS}, got ${embedding.length}`
      );
    }

    return embedding;
  } catch (error) {
    if (error instanceof EmbeddingError) {
      throw error;
    }

    // Handle OpenAI API errors
    if (error && typeof error === 'object' && 'status' in error) {
      const apiError = error as { status?: number; message?: string };

      if (apiError.status === 429) {
        throw new EmbeddingError(
          'OpenAI API rate limit exceeded. Please try again later.',
          error
        );
      }

      if (apiError.status === 401) {
        throw new EmbeddingError(
          'Invalid OpenAI API key. Please check your OPENAI_API_KEY environment variable.',
          error
        );
      }
    }

    throw new EmbeddingError(
      `Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error
    );
  }
}

/**
 * Batch generate embeddings for multiple texts
 *
 * More efficient than calling generateEmbedding() multiple times
 * Uses OpenAI's batch API when possible
 *
 * @param texts - Array of texts to generate embeddings for
 * @returns Array of vector embeddings
 * @throws {EmbeddingError} If embedding generation fails
 */
export async function generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  if (!texts || texts.length === 0) {
    return [];
  }

  try {
    const client = getOpenAIClient();

    // Truncate all texts
    const truncatedTexts = texts.map((text) =>
      text.length > MAX_TEXT_LENGTH ? text.substring(0, MAX_TEXT_LENGTH) : text
    );

    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: truncatedTexts,
      encoding_format: 'float',
    });

    if (!response.data || response.data.length !== texts.length) {
      throw new EmbeddingError(
        `OpenAI API returned unexpected number of embeddings: expected ${texts.length}, got ${response.data?.length || 0}`
      );
    }

    // Verify dimensions for all embeddings
    const embeddings = response.data.map((item, index) => {
      if (item.embedding.length !== EXPECTED_DIMENSIONS) {
        throw new EmbeddingError(
          `Embedding ${index} has unexpected dimensions: expected ${EXPECTED_DIMENSIONS}, got ${item.embedding.length}`
        );
      }
      return item.embedding;
    });

    return embeddings;
  } catch (error) {
    if (error instanceof EmbeddingError) {
      throw error;
    }

    throw new EmbeddingError(
      `Failed to generate batch embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error
    );
  }
}
