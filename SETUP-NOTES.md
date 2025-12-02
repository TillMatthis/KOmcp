# Phase 3 Setup Notes

## Important Setup Steps After Pulling Phase 3

Phase 3 introduces Kura database integration with Prisma and pgvector. Follow these steps to complete setup:

### 1. Generate Prisma Client

The Prisma client needs to be generated from the schema:

```bash
npx prisma generate
```

This will create the `@prisma/client` module used by `src/services/kura.ts`.

### 2. Configure Embedding Service

**CRITICAL:** The embedding service (`src/services/embeddings.ts`) is currently a placeholder. You MUST implement it to match Kura's embedding model, otherwise semantic search will not work.

#### Option A: Using OpenAI Embeddings

If Kura uses OpenAI embeddings (most common):

```bash
# Install OpenAI SDK
npm install openai

# Add to .env
OPENAI_API_KEY=sk-...
```

Then update `src/services/embeddings.ts`:

```typescript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small', // Match Kura's model!
    input: text,
  });
  return response.data[0].embedding;
}
```

#### Option B: Using Local Model

If Kura uses a local embedding model:

```typescript
// Implement based on your model (e.g., Sentence Transformers, local API)
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch('http://localhost:8000/embed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const data = await response.json();
  return data.embedding;
}
```

### 3. Verify Kura Database Connection

Ensure your `.env` has the correct Kura database URL:

```bash
KURA_DATABASE_URL=postgresql://komcp_readonly:password@localhost:5432/kura
```

Test the connection:

```bash
npx prisma db pull
```

This should successfully connect and show the `notes` table schema.

### 4. Create Read-Only Database User (if not done)

For security, KOmcp should use a read-only user:

```sql
-- Connect to Kura's PostgreSQL
psql -h localhost -U postgres -d kura

-- Create read-only user
CREATE USER komcp_readonly WITH PASSWORD 'your_secure_password';
GRANT CONNECT ON DATABASE kura TO komcp_readonly;
GRANT USAGE ON SCHEMA public TO komcp_readonly;
GRANT SELECT ON public.notes TO komcp_readonly;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO komcp_readonly;

-- Verify
\du komcp_readonly
```

### 5. Verify pgvector Extension

KOmcp requires the pgvector extension in Kura's database:

```sql
-- Check if pgvector is installed
SELECT * FROM pg_extension WHERE extname = 'vector';

-- If not installed (should already be in Kura):
CREATE EXTENSION IF NOT EXISTS vector;
```

### 6. Test Search (After Embedding Implementation)

Once embeddings are configured, test the search:

```bash
npm run dev
```

Then test the protected endpoint (you'll need a valid OAuth token from KOauth):

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3003/protected
```

### Next Steps

After completing these setup steps, you'll be ready to:
- Implement Phase 4: MCP protocol endpoints (tools/list, tools/call)
- Connect the Kura search service to MCP tools
- Test end-to-end with Claude

## Troubleshooting

### "Cannot find module '@prisma/client'"

Run `npx prisma generate`

### "Embedding generation not configured"

Implement `generateEmbedding()` in `src/services/embeddings.ts` as described above

### "relation 'notes' does not exist"

Check your `KURA_DATABASE_URL` is correct and points to Kura's database

### Vector similarity returns no results

- Verify `min_similarity` threshold (try lowering to 0.5)
- Ensure embedding model matches what Kura uses for indexing
- Check that notes have embeddings: `SELECT COUNT(*) FROM notes WHERE embedding IS NOT NULL`
