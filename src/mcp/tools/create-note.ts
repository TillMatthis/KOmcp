import { getKuraClient, KuraApiError } from '../../services/kura-client';
import { ToolResult } from '../../types/mcp';

/**
 * Input parameters for create_note tool
 */
export interface CreateNoteInput {
  content: string;
  title?: string;
  annotation?: string;
  tags?: string[];
  contentType?: string;
}

/**
 * Execute the create_note tool
 *
 * Calls Kura's /api/capture endpoint to create a new note
 *
 * @param accessToken - OAuth access token to authenticate with Kura
 * @param input - Note creation parameters
 * @returns MCP tool result with created note details
 */
export async function executeCreateNote(
  accessToken: string,
  input: CreateNoteInput
): Promise<ToolResult> {
  try {
    // Get Kura API client
    const kuraClient = getKuraClient();

    // Call Kura's create note API
    const createResponse = await kuraClient.createNote(accessToken, {
      content: input.content,
      title: input.title,
      annotation: input.annotation,
      tags: input.tags,
      contentType: input.contentType,
    });

    // Format success response
    const formattedText = formatCreateSuccess(createResponse, input);

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
            text: `❌ **Failed to Create Note**\n\n${error.message}\n\n${
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
          text: `❌ **Unexpected Error**\n\nAn unexpected error occurred while creating the note: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Format successful note creation response
 */
function formatCreateSuccess(
  response: { id: string; message: string },
  input: CreateNoteInput
): string {
  let text = `# ✅ Note Created Successfully\n\n`;
  text += `**Note ID:** ${response.id}\n\n`;

  if (input.title) {
    text += `**Title:** ${input.title}\n\n`;
  }

  if (input.tags && input.tags.length > 0) {
    text += `**Tags:** ${input.tags.map((tag) => `#${tag}`).join(', ')}\n\n`;
  }

  if (input.annotation) {
    text += `**Annotation:** ${input.annotation}\n\n`;
  }

  // Show a preview of the content (first 200 characters)
  const contentPreview =
    input.content.length > 200
      ? input.content.substring(0, 200) + '...'
      : input.content;

  text += `**Content Preview:**\n\n${contentPreview}\n\n`;
  text += `---\n\n`;
  text += `The note has been saved to your Kura account and is now searchable.`;

  return text;
}
