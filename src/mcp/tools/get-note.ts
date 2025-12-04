import { getKuraClient, KuraApiError } from '../../services/kura-client';
import { ToolResult } from '../../types/mcp';

/**
 * Input parameters for get_note tool
 */
export interface GetNoteInput {
  note_id: string;
}

/**
 * Execute the get_note tool
 *
 * Calls Kura's /api/content/{id} endpoint to retrieve a note
 *
 * @param accessToken - OAuth access token to authenticate with Kura
 * @param input - Note ID to retrieve
 * @returns MCP tool result with full note content
 */
export async function executeGetNote(
  accessToken: string,
  input: GetNoteInput
): Promise<ToolResult> {
  try {
    // Get Kura API client
    const kuraClient = getKuraClient();

    // Call Kura's get note API
    const noteContent = await kuraClient.getNote(accessToken, input.note_id);

    // Format note content for display
    const formattedText = formatNoteContent(noteContent);

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
            text: `❌ **Failed to Retrieve Note**\n\n${error.message}\n\n${
              error.statusCode === 404
                ? 'The note may have been deleted or the ID is incorrect.'
                : error.statusCode === 401
                ? 'Your access token may have expired. Please re-authenticate.'
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
          text: `❌ **Unexpected Error**\n\nAn unexpected error occurred while retrieving the note: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Format note content for display
 */
function formatNoteContent(note: {
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
}): string {
  let text = `# 📄 ${note.title}\n\n`;

  // Metadata section
  text += `**Note ID:** ${note.id}\n`;
  text += `**Content Type:** ${note.contentType}\n`;

  if (note.metadata.createdAt) {
    text += `**Created:** ${formatDate(new Date(note.metadata.createdAt))}\n`;
  }

  if (note.metadata.updatedAt) {
    text += `**Last Updated:** ${formatDate(new Date(note.metadata.updatedAt))}\n`;
  }

  if (note.metadata.tags && note.metadata.tags.length > 0) {
    text += `**Tags:** ${note.metadata.tags.map((tag) => `#${tag}`).join(', ')}\n`;
  }

  if (note.metadata.source) {
    text += `**Source:** ${note.metadata.source}\n`;
  }

  if (note.metadata.annotation) {
    text += `\n**Annotation:** ${note.metadata.annotation}\n`;
  }

  text += `\n---\n\n`;

  // Full content
  text += `${note.content}\n`;

  return text;
}

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return `Today at ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
  } else if (diffDays === 1) {
    return `Yesterday at ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
