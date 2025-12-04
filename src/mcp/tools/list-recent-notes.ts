import { getKuraClient, KuraApiError } from '../../services/kura-client';
import { ToolResult } from '../../types/mcp';

/**
 * Execute the list_recent_notes tool
 *
 * Calls Kura's /api/content/recent endpoint to get recent notes
 *
 * @param accessToken - OAuth access token to authenticate with Kura
 * @returns MCP tool result with list of recent notes
 */
export async function executeListRecentNotes(accessToken: string): Promise<ToolResult> {
  try {
    // Get Kura API client
    const kuraClient = getKuraClient();

    // Call Kura's list recent notes API
    const recentNotes = await kuraClient.listRecentNotes(accessToken);

    // Format results for display
    if (recentNotes.notes.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: formatNoNotes(),
          },
        ],
        isError: false,
      };
    }

    const formattedText = formatRecentNotes(recentNotes);

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
            text: `❌ **Failed to List Recent Notes**\n\n${error.message}\n\n${
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
          text: `❌ **Unexpected Error**\n\nAn unexpected error occurred while listing recent notes: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Format recent notes for display
 */
function formatRecentNotes(response: {
  notes: Array<{
    id: string;
    title: string;
    contentType: string;
    createdAt: string;
    updatedAt: string;
    tags?: string[];
  }>;
  total: number;
}): string {
  let text = `# 📋 Recent Notes\n\n`;
  text += `Showing ${response.notes.length} most recent ${
    response.notes.length === 1 ? 'note' : 'notes'
  }\n\n`;
  text += `---\n\n`;

  response.notes.forEach((note, index) => {
    text += `## ${index + 1}. ${note.title}\n\n`;
    text += `**Note ID:** ${note.id}\n`;
    text += `**Type:** ${note.contentType}\n`;
    text += `**Updated:** ${formatDate(new Date(note.updatedAt))}\n`;

    if (note.tags && note.tags.length > 0) {
      text += `**Tags:** ${note.tags.map((tag) => `#${tag}`).join(', ')}\n`;
    }

    text += `\n---\n\n`;
  });

  text += `💡 *Use the get_note tool with a note ID to view full content.*`;

  return text;
}

/**
 * Format message when no notes exist
 */
function formatNoNotes(): string {
  return (
    `# 📋 No Recent Notes\n\n` +
    `You don't have any notes in your Kura account yet.\n\n` +
    `**Get started:**\n` +
    `- Use the create_note tool to add your first note\n` +
    `- Capture important information, ideas, or code snippets\n` +
    `- Your notes will appear here once you create them`
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
