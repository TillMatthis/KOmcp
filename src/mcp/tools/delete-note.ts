import { getKuraClient, KuraApiError } from '../../services/kura-client';
import { ToolResult } from '../../types/mcp';

/**
 * Input parameters for delete_note tool
 */
export interface DeleteNoteInput {
  note_id: string;
}

/**
 * Execute the delete_note tool
 *
 * Calls Kura's /api/content/{id} DELETE endpoint to delete a note
 *
 * @param accessToken - OAuth access token to authenticate with Kura
 * @param input - Note ID to delete
 * @returns MCP tool result confirming deletion
 */
export async function executeDeleteNote(
  accessToken: string,
  input: DeleteNoteInput
): Promise<ToolResult> {
  try {
    // Get Kura API client
    const kuraClient = getKuraClient();

    // Call Kura's delete note API
    await kuraClient.deleteNote(accessToken, input.note_id);

    // Format success response
    const formattedText = formatDeleteSuccess(input.note_id);

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
            text: `❌ **Failed to Delete Note**\n\n${error.message}\n\n${
              error.statusCode === 404
                ? 'The note may have already been deleted or the ID is incorrect.'
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
          text: `❌ **Unexpected Error**\n\nAn unexpected error occurred while deleting the note: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Format successful deletion response
 */
function formatDeleteSuccess(noteId: string): string {
  let text = `# 🗑️ Note Deleted Successfully\n\n`;
  text += `**Note ID:** ${noteId}\n\n`;
  text += `---\n\n`;
  text += `The note has been permanently deleted from your Kura account.\n\n`;
  text += `⚠️ **Note:** This action cannot be undone. The note and all its content have been removed.`;

  return text;
}
