/**
 * Kura database types and search results
 */

/**
 * Note from Kura database
 */
export interface KuraNote {
  id: string;
  user_id: string;
  title: string;
  content: string;
  embedding: number[] | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Search result with similarity score
 */
export interface SearchResult {
  id: string;
  title: string;
  content: string;
  similarity: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * Complete search response
 */
export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query_embedding_time_ms: number;
  search_time_ms: number;
}

/**
 * Search parameters
 */
export interface SearchParams {
  query: string;
  limit?: number;
  min_similarity?: number;
}
