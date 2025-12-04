import { getKuraClient, KuraApiError } from '../../services/kura-client';
import { SearchNotesInput, ToolResult } from '../../types/mcp';

/**
 * Execute the search_kura_notes tool
 *
 * Calls Kura's search API to find notes using semantic similarity.
 * Much simpler than direct database access - Kura handles all the complexity.
 *
 * @param accessToken - OAuth access token to authenticate with Kura
 * @param input - Search parameters (query, limit)
 * @returns MCP tool result with formatted search results
 */
export async function executeSearchNotes(
  accessToken: string,
  input: SearchNotesInput
): Promise<ToolResult> {
  try {
    // Get Kura API client
    const kuraClient = getKuraClient();

    // Call Kura's search API
    const searchResponse = await kuraClient.search(accessToken, {
      query: input.query,
      limit: input.limit,
    });

    // Format results for MCP
    if (searchResponse.results.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: formatNoResults(input.query),
          },
        ],
        isError: false,
      };
    }

    // Format results as text
    const formattedText = formatSearchResults(searchResponse);

    return {
      content: [
        {
          type: 'text',
          text: formattedText,
        },
      ],
      isError: false,
    };
  } catch (error) {
    // Handle Kura API errors
    if (error instanceof KuraApiError) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ **Kura API Error**\n\n${error.message}\n\n${
              error.statusCode === 401
                ? 'Your access token may have expired. Please re-authenticate.'
                : error.statusCode === 404
                ? 'Make sure Kura is running and accessible.'
                : 'Please try again or contact support if the problem persists.'
            }`,
          },
        ],
        isError: true,
      };
    }

    // Handle unexpected errors
    return {
      content: [
        {
          type: 'text',
          text: `❌ **Unexpected Error**\n\nAn unexpected error occurred during search: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Format search results for display to the user
 */
function formatSearchResults(searchResponse: {
  results: Array<{
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
  }>;
  totalResults: number;
  query: string;
  searchMethod: string;
  timestamp: string;
}): string {
  const { results, totalResults, query, searchMethod } = searchResponse;

  let text = `# 🔍 Search Results\n\n`;
  text += `Found **${totalResults}** ${totalResults === 1 ? 'note' : 'notes'} `;
  text += `for "${query}" (method: ${searchMethod})\n\n`;
  text += `---\n\n`;

  results.forEach((result, index) => {
    const relevancePercent = (result.relevanceScore * 100).toFixed(1);

    text += `## ${index + 1}. ${result.title}\n\n`;
    text += `**Relevance:** ${relevancePercent}%`;

    if (result.metadata.updatedAt) {
      text += ` | **Updated:** ${formatDate(new Date(result.metadata.updatedAt))}`;
    }

    if (result.metadata.tags && result.metadata.tags.length > 0) {
      text += `\n**Tags:** ${result.metadata.tags.map((tag) => `#${tag}`).join(', ')}`;
    }

    text += `\n\n${result.excerpt}\n\n`;

    if (result.metadata.source) {
      text += `*Source: ${result.metadata.source}*\n\n`;
    }

    text += `*Note ID: ${result.id}*\n\n`;
    text += `---\n\n`;
  });

  return text.trim();
}

/**
 * Format message when no results are found
 */
function formatNoResults(query: string): string {
  return (
    `# 🔍 No Results Found\n\n` +
    `No notes found matching **"${query}"**.\n\n` +
    `**Suggestions:**\n` +
    `- Try different keywords or phrases\n` +
    `- Use more general terms\n` +
    `- Check if notes exist in your Kura account\n` +
    `- Make sure your notes have been indexed`
  );
}

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
  } else {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
}
