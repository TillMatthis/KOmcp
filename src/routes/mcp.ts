import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../middleware/auth';
import { RequiredScope } from '../types/auth';
import { MCP_TOOLS } from '../mcp/schemas';
import { executeSearchNotes } from '../mcp/tools/search-notes';
import { executeCreateNote, CreateNoteInput } from '../mcp/tools/create-note';
import { executeGetNote, GetNoteInput } from '../mcp/tools/get-note';
import { executeListRecentNotes } from '../mcp/tools/list-recent-notes';
import { executeDeleteNote, DeleteNoteInput } from '../mcp/tools/delete-note';
import { SearchNotesInput } from '../types/mcp';

/**
 * JSON-RPC 2.0 request structure
 */
interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: any;
}

/**
 * JSON-RPC 2.0 response structure
 */
interface JsonRpcResponse {
  jsonrpc: '2.0';
  id?: string | number | null;
  result?: any;
  error?: JsonRpcError;
}

/**
 * JSON-RPC 2.0 error structure
 */
interface JsonRpcError {
  code: number;
  message: string;
  data?: any;
}

/**
 * JSON-RPC 2.0 error codes
 */
enum JsonRpcErrorCode {
  PARSE_ERROR = -32700,
  INVALID_REQUEST = -32600,
  METHOD_NOT_FOUND = -32601,
  INVALID_PARAMS = -32602,
  INTERNAL_ERROR = -32603,
}

/**
 * Register MCP protocol routes
 *
 * Implements JSON-RPC 2.0 over HTTP for MCP protocol.
 * Supports methods:
 * - tools/list: Returns available tools
 * - tools/call: Executes a tool
 *
 * All endpoints require OAuth2 authentication and appropriate scopes.
 */
export async function registerMcpRoutes(server: FastifyInstance): Promise<void> {
  /**
   * POST /mcp
   *
   * JSON-RPC 2.0 endpoint for MCP protocol
   *
   * Authentication: Required (Bearer token)
   * Scopes: mcp:tools:read (for tools/list), mcp:tools:execute (for tools/call)
   */
  server.post(
    '/mcp',
    {
      preHandler: [authMiddleware],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Parse JSON-RPC request
        const rpcRequest = request.body as JsonRpcRequest;

        // Validate JSON-RPC structure
        if (rpcRequest.jsonrpc !== '2.0') {
          return reply.status(400).send(
            createErrorResponse(
              rpcRequest.id,
              JsonRpcErrorCode.INVALID_REQUEST,
              'Invalid JSON-RPC version. Must be "2.0"'
            )
          );
        }

        if (!rpcRequest.method || typeof rpcRequest.method !== 'string') {
          return reply.status(400).send(
            createErrorResponse(
              rpcRequest.id,
              JsonRpcErrorCode.INVALID_REQUEST,
              'Missing or invalid method field'
            )
          );
        }

        // Route to appropriate handler
        switch (rpcRequest.method) {
          case 'tools/list':
            return handleToolsList(request, reply, rpcRequest);

          case 'tools/call':
            return handleToolsCall(request, reply, rpcRequest);

          default:
            return reply.status(404).send(
              createErrorResponse(
                rpcRequest.id,
                JsonRpcErrorCode.METHOD_NOT_FOUND,
                `Method not found: ${rpcRequest.method}`
              )
            );
        }
      } catch (error) {
        request.log.error({ error }, 'Error handling MCP request');
        return reply.status(500).send(
          createErrorResponse(
            null,
            JsonRpcErrorCode.INTERNAL_ERROR,
            'Internal server error'
          )
        );
      }
    }
  );
}

/**
 * Handle tools/list method
 *
 * Returns list of available tools that the user can call.
 * Requires mcp:tools:read scope.
 */
async function handleToolsList(
  request: FastifyRequest,
  reply: FastifyReply,
  rpcRequest: JsonRpcRequest
): Promise<void> {
  // Check required scope
  const user = (request as any).user;
  if (!user || !user.scopes.includes(RequiredScope.TOOLS_READ)) {
    return reply.status(403).send(
      createErrorResponse(
        rpcRequest.id,
        JsonRpcErrorCode.INTERNAL_ERROR,
        'Insufficient scope. Required: mcp:tools:read',
        { required_scope: RequiredScope.TOOLS_READ }
      )
    );
  }

  // Return available tools
  return reply.send(
    createSuccessResponse(rpcRequest.id, {
      tools: MCP_TOOLS,
    })
  );
}

/**
 * Handle tools/call method
 *
 * Executes a tool with provided parameters.
 * Requires mcp:tools:execute scope.
 */
async function handleToolsCall(
  request: FastifyRequest,
  reply: FastifyReply,
  rpcRequest: JsonRpcRequest
): Promise<void> {
  // Check required scope
  const user = (request as any).user;
  if (!user || !user.scopes.includes(RequiredScope.TOOLS_EXECUTE)) {
    return reply.status(403).send(
      createErrorResponse(
        rpcRequest.id,
        JsonRpcErrorCode.INTERNAL_ERROR,
        'Insufficient scope. Required: mcp:tools:execute',
        { required_scope: RequiredScope.TOOLS_EXECUTE }
      )
    );
  }

  // Validate params structure
  const params = rpcRequest.params;
  if (!params || typeof params !== 'object') {
    return reply.status(400).send(
      createErrorResponse(
        rpcRequest.id,
        JsonRpcErrorCode.INVALID_PARAMS,
        'Missing or invalid params field'
      )
    );
  }

  const { name, arguments: toolArgs } = params;

  // Validate tool name
  if (!name || typeof name !== 'string') {
    return reply.status(400).send(
      createErrorResponse(
        rpcRequest.id,
        JsonRpcErrorCode.INVALID_PARAMS,
        'Missing or invalid tool name'
      )
    );
  }

  // Route to appropriate tool executor
  switch (name) {
    case 'search_kura_notes':
      return handleSearchKuraNotes(request, reply, rpcRequest, toolArgs);

    case 'create_note':
      return handleCreateNote(request, reply, rpcRequest, toolArgs);

    case 'get_note':
      return handleGetNote(request, reply, rpcRequest, toolArgs);

    case 'list_recent_notes':
      return handleListRecentNotes(request, reply, rpcRequest, toolArgs);

    case 'delete_note':
      return handleDeleteNote(request, reply, rpcRequest, toolArgs);

    default:
      return reply.status(404).send(
        createErrorResponse(
          rpcRequest.id,
          JsonRpcErrorCode.METHOD_NOT_FOUND,
          `Unknown tool: ${name}`,
          {
            available_tools: [
              'search_kura_notes',
              'create_note',
              'get_note',
              'list_recent_notes',
              'delete_note',
            ],
          }
        )
      );
  }
}

/**
 * Handle search_kura_notes tool execution
 */
async function handleSearchKuraNotes(
  request: FastifyRequest,
  reply: FastifyReply,
  rpcRequest: JsonRpcRequest,
  toolArgs: any
): Promise<void> {
  try {
    // Validate tool arguments
    if (!toolArgs || typeof toolArgs !== 'object') {
      return reply.status(400).send(
        createErrorResponse(
          rpcRequest.id,
          JsonRpcErrorCode.INVALID_PARAMS,
          'Invalid tool arguments. Expected object.'
        )
      );
    }

    // Validate required query parameter
    if (!toolArgs.query || typeof toolArgs.query !== 'string') {
      return reply.status(400).send(
        createErrorResponse(
          rpcRequest.id,
          JsonRpcErrorCode.INVALID_PARAMS,
          'Missing or invalid "query" parameter'
        )
      );
    }

    // Validate optional parameters
    if (toolArgs.limit !== undefined) {
      if (typeof toolArgs.limit !== 'number' || toolArgs.limit < 1 || toolArgs.limit > 50) {
        return reply.status(400).send(
          createErrorResponse(
            rpcRequest.id,
            JsonRpcErrorCode.INVALID_PARAMS,
            'Invalid "limit" parameter. Must be a number between 1 and 50.'
          )
        );
      }
    }

    if (toolArgs.min_similarity !== undefined) {
      if (
        typeof toolArgs.min_similarity !== 'number' ||
        toolArgs.min_similarity < 0 ||
        toolArgs.min_similarity > 1
      ) {
        return reply.status(400).send(
          createErrorResponse(
            rpcRequest.id,
            JsonRpcErrorCode.INVALID_PARAMS,
            'Invalid "min_similarity" parameter. Must be a number between 0 and 1.'
          )
        );
      }
    }

    // Build search input
    const searchInput: SearchNotesInput = {
      query: toolArgs.query,
      limit: toolArgs.limit,
      min_similarity: toolArgs.min_similarity,
    };

    // Get access token from request header
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      request.log.error('Access token not found in request');
      return reply.status(500).send(
        createErrorResponse(
          rpcRequest.id,
          JsonRpcErrorCode.INTERNAL_ERROR,
          'Internal server error: Access token not found'
        )
      );
    }

    const accessToken = authHeader.substring(7); // Remove "Bearer " prefix

    // Execute search (pass token to Kura API)
    const result = await executeSearchNotes(accessToken, searchInput);

    // Return tool result
    return reply.send(createSuccessResponse(rpcRequest.id, result));
  } catch (error) {
    request.log.error({ error }, 'Error executing search_kura_notes tool');

    // Return error response
    return reply.status(500).send(
      createErrorResponse(
        rpcRequest.id,
        JsonRpcErrorCode.INTERNAL_ERROR,
        'Tool execution failed',
        {
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      )
    );
  }
}

/**
 * Handle create_note tool execution
 */
async function handleCreateNote(
  request: FastifyRequest,
  reply: FastifyReply,
  rpcRequest: JsonRpcRequest,
  toolArgs: any
): Promise<void> {
  try {
    // Validate tool arguments
    if (!toolArgs || typeof toolArgs !== 'object') {
      return reply.status(400).send(
        createErrorResponse(
          rpcRequest.id,
          JsonRpcErrorCode.INVALID_PARAMS,
          'Invalid tool arguments. Expected object.'
        )
      );
    }

    // Validate required content parameter
    if (!toolArgs.content || typeof toolArgs.content !== 'string') {
      return reply.status(400).send(
        createErrorResponse(
          rpcRequest.id,
          JsonRpcErrorCode.INVALID_PARAMS,
          'Missing or invalid "content" parameter'
        )
      );
    }

    // Build create input
    const createInput: CreateNoteInput = {
      content: toolArgs.content,
      title: toolArgs.title,
      annotation: toolArgs.annotation,
      tags: toolArgs.tags,
      contentType: toolArgs.contentType,
    };

    // Get access token
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      request.log.error('Access token not found in request');
      return reply.status(500).send(
        createErrorResponse(
          rpcRequest.id,
          JsonRpcErrorCode.INTERNAL_ERROR,
          'Internal server error: Access token not found'
        )
      );
    }

    const accessToken = authHeader.substring(7);

    // Execute create note
    const result = await executeCreateNote(accessToken, createInput);

    // Return tool result
    return reply.send(createSuccessResponse(rpcRequest.id, result));
  } catch (error) {
    request.log.error({ error }, 'Error executing create_note tool');
    return reply.status(500).send(
      createErrorResponse(
        rpcRequest.id,
        JsonRpcErrorCode.INTERNAL_ERROR,
        'Tool execution failed',
        {
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      )
    );
  }
}

/**
 * Handle get_note tool execution
 */
async function handleGetNote(
  request: FastifyRequest,
  reply: FastifyReply,
  rpcRequest: JsonRpcRequest,
  toolArgs: any
): Promise<void> {
  try {
    // Validate tool arguments
    if (!toolArgs || typeof toolArgs !== 'object') {
      return reply.status(400).send(
        createErrorResponse(
          rpcRequest.id,
          JsonRpcErrorCode.INVALID_PARAMS,
          'Invalid tool arguments. Expected object.'
        )
      );
    }

    // Validate required note_id parameter
    if (!toolArgs.note_id || typeof toolArgs.note_id !== 'string') {
      return reply.status(400).send(
        createErrorResponse(
          rpcRequest.id,
          JsonRpcErrorCode.INVALID_PARAMS,
          'Missing or invalid "note_id" parameter'
        )
      );
    }

    // Build get input
    const getInput: GetNoteInput = {
      note_id: toolArgs.note_id,
    };

    // Get access token
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      request.log.error('Access token not found in request');
      return reply.status(500).send(
        createErrorResponse(
          rpcRequest.id,
          JsonRpcErrorCode.INTERNAL_ERROR,
          'Internal server error: Access token not found'
        )
      );
    }

    const accessToken = authHeader.substring(7);

    // Execute get note
    const result = await executeGetNote(accessToken, getInput);

    // Return tool result
    return reply.send(createSuccessResponse(rpcRequest.id, result));
  } catch (error) {
    request.log.error({ error }, 'Error executing get_note tool');
    return reply.status(500).send(
      createErrorResponse(
        rpcRequest.id,
        JsonRpcErrorCode.INTERNAL_ERROR,
        'Tool execution failed',
        {
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      )
    );
  }
}

/**
 * Handle list_recent_notes tool execution
 */
async function handleListRecentNotes(
  request: FastifyRequest,
  reply: FastifyReply,
  rpcRequest: JsonRpcRequest,
  _toolArgs: any
): Promise<void> {
  try {
    // No arguments needed for list_recent_notes

    // Get access token
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      request.log.error('Access token not found in request');
      return reply.status(500).send(
        createErrorResponse(
          rpcRequest.id,
          JsonRpcErrorCode.INTERNAL_ERROR,
          'Internal server error: Access token not found'
        )
      );
    }

    const accessToken = authHeader.substring(7);

    // Execute list recent notes
    const result = await executeListRecentNotes(accessToken);

    // Return tool result
    return reply.send(createSuccessResponse(rpcRequest.id, result));
  } catch (error) {
    request.log.error({ error }, 'Error executing list_recent_notes tool');
    return reply.status(500).send(
      createErrorResponse(
        rpcRequest.id,
        JsonRpcErrorCode.INTERNAL_ERROR,
        'Tool execution failed',
        {
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      )
    );
  }
}

/**
 * Handle delete_note tool execution
 */
async function handleDeleteNote(
  request: FastifyRequest,
  reply: FastifyReply,
  rpcRequest: JsonRpcRequest,
  toolArgs: any
): Promise<void> {
  try {
    // Validate tool arguments
    if (!toolArgs || typeof toolArgs !== 'object') {
      return reply.status(400).send(
        createErrorResponse(
          rpcRequest.id,
          JsonRpcErrorCode.INVALID_PARAMS,
          'Invalid tool arguments. Expected object.'
        )
      );
    }

    // Validate required note_id parameter
    if (!toolArgs.note_id || typeof toolArgs.note_id !== 'string') {
      return reply.status(400).send(
        createErrorResponse(
          rpcRequest.id,
          JsonRpcErrorCode.INVALID_PARAMS,
          'Missing or invalid "note_id" parameter'
        )
      );
    }

    // Build delete input
    const deleteInput: DeleteNoteInput = {
      note_id: toolArgs.note_id,
    };

    // Get access token
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      request.log.error('Access token not found in request');
      return reply.status(500).send(
        createErrorResponse(
          rpcRequest.id,
          JsonRpcErrorCode.INTERNAL_ERROR,
          'Internal server error: Access token not found'
        )
      );
    }

    const accessToken = authHeader.substring(7);

    // Execute delete note
    const result = await executeDeleteNote(accessToken, deleteInput);

    // Return tool result
    return reply.send(createSuccessResponse(rpcRequest.id, result));
  } catch (error) {
    request.log.error({ error }, 'Error executing delete_note tool');
    return reply.status(500).send(
      createErrorResponse(
        rpcRequest.id,
        JsonRpcErrorCode.INTERNAL_ERROR,
        'Tool execution failed',
        {
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      )
    );
  }
}

/**
 * Create JSON-RPC 2.0 success response
 */
function createSuccessResponse(id: string | number | null | undefined, result: any): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    id: id ?? null,
    result,
  };
}

/**
 * Create JSON-RPC 2.0 error response
 */
function createErrorResponse(
  id: string | number | null | undefined,
  code: number,
  message: string,
  data?: any
): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    id: id ?? null,
    error: {
      code,
      message,
      ...(data && { data }),
    },
  };
}
