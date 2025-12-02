/**
 * MCP tool schemas and definitions
 */

/**
 * Schema for search_kura_notes tool
 * Defines the input parameters accepted by the semantic search tool
 */
export const SEARCH_NOTES_TOOL = {
  name: 'search_kura_notes',
  description:
    'Search Kura notes using semantic similarity. Finds notes that are conceptually related to the search query, ' +
    'even if they don\'t contain the exact keywords. Perfect for finding relevant information across your notes.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string' as const,
        description:
          'Natural language search query. Describe what you\'re looking for in plain English. ' +
          'Examples: "machine learning algorithms", "how to deploy Docker", "Python async programming"',
        minLength: 1,
        maxLength: 1000,
      },
      limit: {
        type: 'number' as const,
        description:
          'Maximum number of results to return. Default is 10. Increase for more comprehensive results.',
        minimum: 1,
        maximum: 50,
        default: 10,
      },
      min_similarity: {
        type: 'number' as const,
        description:
          'Minimum similarity threshold (0-1). Higher values return only very similar notes. ' +
          'Lower values cast a wider net. Default is 0.7 (70% similar).',
        minimum: 0,
        maximum: 1,
        default: 0.7,
      },
    },
    required: ['query'],
  },
};

/**
 * List of all available MCP tools
 * Add new tools here as they are implemented
 */
export const MCP_TOOLS = [SEARCH_NOTES_TOOL];
