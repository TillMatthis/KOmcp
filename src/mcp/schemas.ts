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
 * Schema for create_note tool
 * Creates a new note in Kura
 */
export const CREATE_NOTE_TOOL = {
  name: 'create_note',
  description:
    'Create a new note in Kura. Capture text content with optional title, annotations, and tags. ' +
    'Perfect for saving important information, meeting notes, code snippets, or any text you want to remember.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      content: {
        type: 'string' as const,
        description:
          'The main content of the note. Can be plain text, markdown, code, or any text content you want to save.',
        minLength: 1,
        maxLength: 100000,
      },
      title: {
        type: 'string' as const,
        description:
          'Optional title for the note. If not provided, Kura will generate one from the content.',
        maxLength: 500,
      },
      annotation: {
        type: 'string' as const,
        description:
          'Optional annotation or comment about the note. Use this to add context or metadata.',
        maxLength: 2000,
      },
      tags: {
        type: 'array' as const,
        items: {
          type: 'string' as const,
        },
        description:
          'Optional array of tags to organize the note. Examples: ["work", "important"], ["python", "tutorial"]',
      },
      contentType: {
        type: 'string' as const,
        description:
          'Optional content type hint. Defaults to "text". Can be used to indicate the type of content (e.g., "code", "markdown").',
        default: 'text',
      },
    },
    required: ['content'],
  },
};

/**
 * Schema for get_note tool
 * Retrieves a specific note by ID
 */
export const GET_NOTE_TOOL = {
  name: 'get_note',
  description:
    'Retrieve the full content of a specific note by its ID. Returns the complete note including content, ' +
    'metadata, tags, and timestamps. Use this when you have a note ID from search results and want to read the full note.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      note_id: {
        type: 'string' as const,
        description:
          'The unique ID of the note to retrieve. You can get note IDs from search results or list_recent_notes.',
        minLength: 1,
      },
    },
    required: ['note_id'],
  },
};

/**
 * Schema for list_recent_notes tool
 * Lists the most recent notes
 */
export const LIST_RECENT_NOTES_TOOL = {
  name: 'list_recent_notes',
  description:
    'List the 20 most recently created or updated notes. Returns a summary view without full content. ' +
    'Perfect for getting an overview of recent activity or finding recently added notes.',
  inputSchema: {
    type: 'object' as const,
    properties: {},
    required: [],
  },
};

/**
 * Schema for delete_note tool
 * Deletes a note by ID
 */
export const DELETE_NOTE_TOOL = {
  name: 'delete_note',
  description:
    'Permanently delete a note by its ID. This action cannot be undone. ' +
    'Use with caution. You should confirm with the user before deleting notes.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      note_id: {
        type: 'string' as const,
        description:
          'The unique ID of the note to delete. You can get note IDs from search results or list_recent_notes.',
        minLength: 1,
      },
    },
    required: ['note_id'],
  },
};

/**
 * List of all available MCP tools
 * Add new tools here as they are implemented
 */
export const MCP_TOOLS = [
  SEARCH_NOTES_TOOL,
  CREATE_NOTE_TOOL,
  GET_NOTE_TOOL,
  LIST_RECENT_NOTES_TOOL,
  DELETE_NOTE_TOOL,
];
