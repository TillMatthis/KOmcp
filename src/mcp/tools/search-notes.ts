import { getKuraSearchService, KuraSearchError } from '../../services/kura';
import { EmbeddingError } from '../../services/embeddings';
import { SearchNotesInput, ToolResult } from '../../types/mcp';

/**
 * Execute the search_kura_notes tool
 *
 * Searches Kura notes using semantic similarity and returns results
 * formatted for MCP tool response.
 *
 * @param userId - User ID from OAuth token (ensures user only sees their notes)
 * @param input - Search parameters (query, limit, min_similarity)
 * @returns MCP tool result with formatted search results
 */
export async function executeSearchNotes(
  userId: string,
  input: SearchNotesInput
): Promise<ToolResult> {
  try {
    // Get Kura search service instance
    const kuraService = getKuraSearchService();

    // Perform semantic search
    const searchResponse = await kuraService.searchNotes(userId, {
      query: input.query,
      limit: input.limit,
      min_similarity: input.min_similarity,
    });

    // Format results for MCP
    if (searchResponse.results.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: formatNoResults(input.query, input.min_similarity),
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
    // Handle embedding errors
    if (error instanceof EmbeddingError) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ **Embedding Error**\n\n${error.message}\n\nThe embedding service needs to be configured. Please check the setup instructions in SETUP-NOTES.md.`,
          },
        ],
        isError: true,
      };
    }

    // Handle Kura search errors
    if (error instanceof KuraSearchError) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ **Search Error**\n\n${error.message}\n\nError code: ${error.code}`,
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
          text: `❌ **Unexpected Error**\n\nAn unexpected error occurred during search. Please try again or contact support if the problem persists.`,
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
    content: string;
    similarity: number;
    created_at: Date;
    updated_at: Date;
  }>;
  total: number;
  query_embedding_time_ms: number;
  search_time_ms: number;
}): string {
  const { results, total, query_embedding_time_ms, search_time_ms } = searchResponse;

  let text = `# 🔍 Search Results\n\n`;
  text += `Found **${total}** ${total === 1 ? 'note' : 'notes'} `;
  text += `(search: ${search_time_ms}ms, embedding: ${query_embedding_time_ms}ms)\n\n`;
  text += `---\n\n`;

  results.forEach((result, index) => {
    const similarityPercent = (result.similarity * 100).toFixed(1);

    text += `## ${index + 1}. ${result.title}\n\n`;
    text += `**Similarity:** ${similarityPercent}% | `;
    text += `**Updated:** ${formatDate(result.updated_at)}\n\n`;

    // Truncate long content for readability
    const contentPreview = truncateContent(result.content, 500);
    text += `${contentPreview}\n\n`;

    text += `*Note ID: ${result.id}*\n\n`;
    text += `---\n\n`;
  });

  return text.trim();
}

/**
 * Format message when no results are found
 */
function formatNoResults(query: string, minSimilarity?: number): string {
  const threshold = minSimilarity ?? 0.7;
  const thresholdPercent = (threshold * 100).toFixed(0);

  return `# 🔍 No Results Found\n\n` +
    `No notes found matching **"${query}"** with similarity ≥ ${thresholdPercent}%.\n\n` +
    `**Suggestions:**\n` +
    `- Try different keywords or phrases\n` +
    `- Lower the similarity threshold (currently ${thresholdPercent}%)\n` +
    `- Check if notes exist in your Kura account\n` +
    `- Make sure your notes have been indexed with embeddings`;
}

/**
 * Truncate content to specified length with ellipsis
 */
function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) {
    return content;
  }

  // Try to truncate at word boundary
  const truncated = content.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > maxLength * 0.8) {
    return truncated.substring(0, lastSpace) + '...';
  }

  return truncated + '...';
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
