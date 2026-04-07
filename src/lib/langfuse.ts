import { Langfuse } from "langfuse";

/**
 * Langfuse client singleton for LLM observability
 * Traces MCP token usage, cost estimation, and provider analytics
 */

let langfuseInstance: Langfuse | null = null;

export function isLangfuseConfigured(): boolean {
  return !!(process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY);
}

export function getLangfuse(): Langfuse | null {
  if (!isLangfuseConfigured()) return null;

  if (!langfuseInstance) {
    langfuseInstance = new Langfuse({
      publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
      secretKey: process.env.LANGFUSE_SECRET_KEY!,
      baseUrl: process.env.LANGFUSE_HOST || "https://cloud.langfuse.com",
      environment: process.env.NODE_ENV,
      release: process.env.VERCEL_GIT_COMMIT_SHA,
    });
  }

  return langfuseInstance;
}

export async function flushLangfuse(): Promise<void> {
  const lf = getLangfuse();
  if (lf) await lf.flushAsync();
}
