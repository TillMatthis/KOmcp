/**
 * Kura API Client
 *
 * Communicates with Kura's search API instead of direct database access.
 * This is a cleaner architecture:
 * - No database credentials needed
 * - Kura handles embeddings, vector search, and all complexity
 * - Simple HTTP calls
 * - Proper separation of concerns
 */

/**
 * Kura search result item
 */
export interface KuraSearchResult {
  id: string;
  title: string;
  excerpt: string;
  contentType: string;
  relevanceScore: number;
  metadata: {
    tags?: string[];
    createdAt?: string;
    updatedAt?: string;
    source?: string;
    annotation?: string;
  };
}

/**
 * Kura API search response
 */
export interface KuraSearchResponse {
  results: KuraSearchResult[];
  totalResults: number;
  query: string;
  searchMethod: 'vector' | 'fts' | 'combined';
  appliedFilters?: {
    contentType?: string[];
    tags?: string[];
    dateFrom?: string;
    dateTo?: string;
  };
  timestamp: string;
}

/**
 * Search parameters
 */
export interface SearchParams {
  query: string;
  limit?: number;
  contentType?: string[];
  tags?: string[];
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Create note parameters
 */
export interface CreateNoteParams {
  content: string;
  contentType?: string;
  title?: string;
  annotation?: string;
  tags?: string[];
}

/**
 * Note content response (for get operations)
 */
export interface KuraNoteContent {
  id: string;
  content: string;
  contentType: string;
  title: string;
  metadata: {
    tags?: string[];
    createdAt?: string;
    updatedAt?: string;
    source?: string;
    annotation?: string;
  };
}

/**
 * Recent notes response
 */
export interface KuraRecentNotesResponse {
  notes: Array<{
    id: string;
    title: string;
    contentType: string;
    createdAt: string;
    updatedAt: string;
    tags?: string[];
  }>;
  total: number;
}

/**
 * Create note response
 */
export interface KuraCreateNoteResponse {
  id: string;
  message: string;
}

/**
 * Custom error for Kura API calls
 */
export class KuraApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public override cause?: unknown
  ) {
    super(message);
    this.name = 'KuraApiError';
  }
}

/**
 * Kura API Client
 *
 * Handles all communication with Kura's search API
 */
export class KuraClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env['KURA_URL'] || 'https://kura.tillmaessen.de';

    // Remove trailing slash
    if (this.baseUrl.endsWith('/')) {
      this.baseUrl = this.baseUrl.slice(0, -1);
    }
  }

  /**
   * Search Kura notes
   *
   * Calls Kura's /api/search endpoint with the user's OAuth token
   *
   * @param accessToken - OAuth access token from KOauth
   * @param params - Search parameters
   * @returns Search results from Kura
   * @throws {KuraApiError} If the API call fails
   */
  async search(accessToken: string, params: SearchParams): Promise<KuraSearchResponse> {
    // Build query parameters
    const queryParams = new URLSearchParams();
    queryParams.append('query', params.query);

    if (params.limit) {
      queryParams.append('limit', params.limit.toString());
    }

    if (params.contentType && params.contentType.length > 0) {
      queryParams.append('contentType', params.contentType.join(','));
    }

    if (params.tags && params.tags.length > 0) {
      queryParams.append('tags', params.tags.join(','));
    }

    if (params.dateFrom) {
      queryParams.append('dateFrom', params.dateFrom);
    }

    if (params.dateTo) {
      queryParams.append('dateTo', params.dateTo);
    }

    // Make API call
    const url = `${this.baseUrl}/api/search?${queryParams.toString()}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'KOmcp/1.0',
        },
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');

        if (response.status === 401) {
          throw new KuraApiError(
            'Unauthorized: Invalid or expired access token',
            401
          );
        }

        if (response.status === 403) {
          throw new KuraApiError(
            'Forbidden: Insufficient permissions to access Kura',
            403
          );
        }

        if (response.status === 404) {
          throw new KuraApiError(
            'Kura API endpoint not found. Is Kura running?',
            404
          );
        }

        throw new KuraApiError(
          `Kura API error (${response.status}): ${errorText}`,
          response.status
        );
      }

      const data = await response.json();
      return data as KuraSearchResponse;
    } catch (error) {
      if (error instanceof KuraApiError) {
        throw error;
      }

      // Network or fetch errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new KuraApiError(
          `Failed to connect to Kura at ${this.baseUrl}. Is Kura running?`,
          undefined,
          error
        );
      }

      throw new KuraApiError(
        `Failed to search Kura: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        error
      );
    }
  }

  /**
   * Create a new note
   *
   * Calls Kura's /api/capture endpoint to create a new note
   *
   * @param accessToken - OAuth access token from KOauth
   * @param params - Note creation parameters
   * @returns Created note response with ID
   * @throws {KuraApiError} If the API call fails
   */
  async createNote(
    accessToken: string,
    params: CreateNoteParams
  ): Promise<KuraCreateNoteResponse> {
    const url = `${this.baseUrl}/api/capture`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'KOmcp/1.0',
        },
        body: JSON.stringify({
          content: params.content,
          contentType: params.contentType || 'text',
          title: params.title,
          annotation: params.annotation,
          tags: params.tags,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new KuraApiError(
          `Failed to create note (${response.status}): ${errorText}`,
          response.status
        );
      }

      const data = await response.json();
      return data as KuraCreateNoteResponse;
    } catch (error) {
      if (error instanceof KuraApiError) {
        throw error;
      }

      throw new KuraApiError(
        `Failed to create note: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        error
      );
    }
  }

  /**
   * Get a note by ID
   *
   * Calls Kura's /api/content/{id} endpoint
   *
   * @param accessToken - OAuth access token from KOauth
   * @param noteId - ID of the note to retrieve
   * @returns Note content with full details
   * @throws {KuraApiError} If the API call fails
   */
  async getNote(accessToken: string, noteId: string): Promise<KuraNoteContent> {
    const url = `${this.baseUrl}/api/content/${noteId}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'KOmcp/1.0',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new KuraApiError(
            `Note with ID "${noteId}" not found`,
            404
          );
        }

        const errorText = await response.text().catch(() => 'Unknown error');
        throw new KuraApiError(
          `Failed to get note (${response.status}): ${errorText}`,
          response.status
        );
      }

      const data = await response.json();
      return data as KuraNoteContent;
    } catch (error) {
      if (error instanceof KuraApiError) {
        throw error;
      }

      throw new KuraApiError(
        `Failed to get note: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        error
      );
    }
  }

  /**
   * List recent notes
   *
   * Calls Kura's /api/content/recent endpoint to get the 20 most recent notes
   *
   * @param accessToken - OAuth access token from KOauth
   * @returns List of recent notes
   * @throws {KuraApiError} If the API call fails
   */
  async listRecentNotes(accessToken: string): Promise<KuraRecentNotesResponse> {
    const url = `${this.baseUrl}/api/content/recent`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'KOmcp/1.0',
        },
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new KuraApiError(
          `Failed to list recent notes (${response.status}): ${errorText}`,
          response.status
        );
      }

      const data = await response.json();
      return data as KuraRecentNotesResponse;
    } catch (error) {
      if (error instanceof KuraApiError) {
        throw error;
      }

      throw new KuraApiError(
        `Failed to list recent notes: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        error
      );
    }
  }

  /**
   * Delete a note
   *
   * Calls Kura's /api/content/{id} endpoint with DELETE method
   *
   * @param accessToken - OAuth access token from KOauth
   * @param noteId - ID of the note to delete
   * @returns Success status
   * @throws {KuraApiError} If the API call fails
   */
  async deleteNote(accessToken: string, noteId: string): Promise<{ success: boolean; message: string }> {
    const url = `${this.baseUrl}/api/content/${noteId}`;

    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'KOmcp/1.0',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new KuraApiError(
            `Note with ID "${noteId}" not found`,
            404
          );
        }

        const errorText = await response.text().catch(() => 'Unknown error');
        throw new KuraApiError(
          `Failed to delete note (${response.status}): ${errorText}`,
          response.status
        );
      }

      return {
        success: true,
        message: `Note ${noteId} deleted successfully`,
      };
    } catch (error) {
      if (error instanceof KuraApiError) {
        throw error;
      }

      throw new KuraApiError(
        `Failed to delete note: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        error
      );
    }
  }

  /**
   * Health check
   *
   * Verify Kura is accessible
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: {
          'User-Agent': 'KOmcp/1.0',
        },
      });

      return response.ok;
    } catch {
      return false;
    }
  }
}

/**
 * Singleton instance
 */
let kuraClient: KuraClient | null = null;

/**
 * Get Kura client instance
 */
export function getKuraClient(): KuraClient {
  if (!kuraClient) {
    kuraClient = new KuraClient();
  }
  return kuraClient;
}
