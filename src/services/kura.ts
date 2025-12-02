import { PrismaClient, Prisma } from '@prisma/client';
import { generateEmbedding, EmbeddingError } from './embeddings';
import { SearchResponse, SearchParams } from '../types/kura';

/**
 * Custom error for Kura database operations
 */
export class KuraSearchError extends Error {
  constructor(
    message: string,
    public code: 'database_error' | 'embedding_error' | 'invalid_params',
    public cause?: unknown
  ) {
    super(message);
    this.name = 'KuraSearchError';
  }
}

/**
 * Kura notes search service
 *
 * Provides semantic search functionality using pgvector for similarity queries.
 * All queries are filtered by user_id to ensure users only see their own notes.
 */
export class KuraSearchService {
  private prisma: PrismaClient;

  constructor() {
    // Initialize Prisma client with Kura database connection
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.KURA_DATABASE_URL,
        },
      },
      // Log queries in development for debugging
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
  }

  /**
   * Search notes using semantic similarity
   *
   * This method:
   * 1. Generates an embedding vector for the search query
   * 2. Performs cosine similarity search using pgvector
   * 3. Filters results by user_id (from OAuth token)
   * 4. Returns results above the minimum similarity threshold
   *
   * @param userId - User ID from OAuth token (sub claim)
   * @param params - Search parameters (query, limit, min_similarity)
   * @returns Search results with similarity scores and timing metrics
   * @throws {KuraSearchError} If search fails
   */
  async searchNotes(userId: string, params: SearchParams): Promise<SearchResponse> {
    const startTime = Date.now();

    // Validate parameters
    const query = params.query?.trim();
    if (!query) {
      throw new KuraSearchError('Search query cannot be empty', 'invalid_params');
    }

    const limit = params.limit ?? 10;
    if (limit < 1 || limit > 50) {
      throw new KuraSearchError('Limit must be between 1 and 50', 'invalid_params');
    }

    const minSimilarity = params.min_similarity ?? 0.7;
    if (minSimilarity < 0 || minSimilarity > 1) {
      throw new KuraSearchError(
        'Minimum similarity must be between 0 and 1',
        'invalid_params'
      );
    }

    try {
      // Step 1: Generate embedding for the query
      const embeddingStartTime = Date.now();
      let queryEmbedding: number[];

      try {
        queryEmbedding = await generateEmbedding(query);
      } catch (error) {
        if (error instanceof EmbeddingError) {
          throw new KuraSearchError(
            `Failed to generate query embedding: ${error.message}`,
            'embedding_error',
            error
          );
        }
        throw error;
      }

      const embeddingTime = Date.now() - embeddingStartTime;

      // Step 2: Perform vector similarity search
      const searchStartTime = Date.now();

      // Convert embedding array to pgvector format
      const embeddingString = `[${queryEmbedding.join(',')}]`;

      // Use raw SQL query for pgvector cosine similarity
      // The <=> operator computes cosine distance (0 = identical, 2 = opposite)
      // Cosine similarity = 1 - cosine_distance
      const results = await this.prisma.$queryRaw<
        Array<{
          id: string;
          title: string;
          content: string;
          created_at: Date;
          updated_at: Date;
          similarity: number;
        }>
      >`
        SELECT
          id,
          title,
          content,
          created_at,
          updated_at,
          1 - (embedding <=> ${embeddingString}::vector) as similarity
        FROM notes
        WHERE
          user_id = ${userId}
          AND embedding IS NOT NULL
          AND 1 - (embedding <=> ${embeddingString}::vector) >= ${minSimilarity}
        ORDER BY embedding <=> ${embeddingString}::vector
        LIMIT ${limit}
      `;

      const searchTime = Date.now() - searchStartTime;

      // Return formatted response
      return {
        results: results.map((result) => ({
          id: result.id,
          title: result.title,
          content: result.content,
          similarity: Number(result.similarity.toFixed(4)), // Round to 4 decimal places
          created_at: result.created_at,
          updated_at: result.updated_at,
        })),
        total: results.length,
        query_embedding_time_ms: embeddingTime,
        search_time_ms: searchTime,
      };
    } catch (error) {
      // Handle Prisma/database errors
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new KuraSearchError(
          `Database error: ${error.message}`,
          'database_error',
          error
        );
      }

      // Re-throw KuraSearchError as-is
      if (error instanceof KuraSearchError) {
        throw error;
      }

      // Unexpected error
      throw new KuraSearchError(
        'Unexpected error during search',
        'database_error',
        error
      );
    }
  }

  /**
   * Check database connection health
   *
   * @returns True if database is accessible
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Close database connection
   * Should be called on application shutdown
   */
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

/**
 * Singleton instance of KuraSearchService
 * Reuse across the application to avoid multiple connections
 */
let kuraSearchServiceInstance: KuraSearchService | null = null;

/**
 * Get or create the KuraSearchService singleton
 *
 * @returns KuraSearchService instance
 */
export function getKuraSearchService(): KuraSearchService {
  if (!kuraSearchServiceInstance) {
    kuraSearchServiceInstance = new KuraSearchService();
  }
  return kuraSearchServiceInstance;
}
