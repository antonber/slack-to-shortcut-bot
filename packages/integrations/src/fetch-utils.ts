export interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
  retries?: number;
  cache?: { key: string; ttlMs: number };
}

interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

/** Clear all cached entries (useful for testing) */
export function clearCache(): void {
  cache.clear();
}

/** Fetch with retry, exponential backoff, timeout, and optional TTL cache */
export async function fetchWithRetry(
  url: string,
  options: FetchOptions = {}
): Promise<unknown> {
  const {
    method = "GET",
    headers = {},
    body,
    timeout = 10_000,
    retries = 3,
    cache: cacheOpts,
  } = options;

  // Check cache
  if (cacheOpts) {
    const cached = cache.get(cacheOpts.key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }
  }

  let lastError: Error | undefined;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...headers },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP ${response.status}: ${errorText}`
        );
      }

      if (response.status === 204) {
        return null;
      }

      const data: unknown = await response.json();

      // Populate cache
      if (cacheOpts) {
        cache.set(cacheOpts.key, {
          data,
          expiresAt: Date.now() + cacheOpts.ttlMs,
        });
      }

      return data;
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error(String(error));

      // Don't retry on 4xx client errors (except 429)
      if (
        lastError.message.startsWith("HTTP 4") &&
        !lastError.message.startsWith("HTTP 429")
      ) {
        throw lastError;
      }

      if (attempt < retries - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, 200 * Math.pow(2, attempt))
        );
      }
    }
  }

  throw lastError ?? new Error("Fetch failed after retries");
}
