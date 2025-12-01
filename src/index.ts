import { buildServer, startServer } from './server';
import { logStartup } from './config/logger';

/**
 * Main entry point for KOmcp MCP Server
 */
async function main(): Promise<void> {
  // Log startup information
  logStartup();

  // Build and configure server
  const server = await buildServer();

  // Start server
  await startServer(server);
}

// Start the application
main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
