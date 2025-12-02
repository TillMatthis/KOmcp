/**
 * MCP (Model Context Protocol) types
 */

/**
 * MCP tool input schema for search_kura_notes
 */
export interface SearchNotesInput {
  query: string;
  limit?: number;
  min_similarity?: number;
}

/**
 * MCP tool result content
 */
export interface ToolContent {
  type: 'text' | 'image' | 'resource';
  text?: string;
  data?: string;
  mimeType?: string;
}

/**
 * MCP tool call result
 */
export interface ToolResult {
  content: ToolContent[];
  isError?: boolean;
}

/**
 * MCP error codes
 */
export enum MCPErrorCode {
  ParseError = -32700,
  InvalidRequest = -32600,
  MethodNotFound = -32601,
  InvalidParams = -32602,
  InternalError = -32603,
}

/**
 * MCP JSON-RPC error
 */
export interface MCPError {
  code: number;
  message: string;
  data?: unknown;
}
