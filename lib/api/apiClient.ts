import axios, { AxiosInstance, AxiosError } from 'axios';
import { getAuthSession } from '@/lib/auth/authStorage';
import type { PrewritePageData, AutofillResponse, CompletionResult } from '@/types/schema';

const BASE_URL = 'http://localhost:4000';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Create axios instance with auth interceptor
 */
function createApiInstance(): AxiosInstance {
  const instance = axios.create({
    baseURL: BASE_URL,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Add auth token to requests
  instance.interceptors.request.use(async (config) => {
    const session = await getAuthSession();
    if (session?.accessToken) {
      config.headers.Authorization = `Bearer ${session.accessToken}`;
    }
    return config;
  });

  // Retry interceptor for failed requests
  instance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const config = error.config;
      if (!config) return Promise.reject(error);

      // @ts-expect-error - custom retry count
      config.__retryCount = config.__retryCount || 0;

      // @ts-expect-error - custom retry count
      if (config.__retryCount >= MAX_RETRIES) {
        return Promise.reject(error);
      }

      // Only retry on network errors or 5xx
      if (!error.response || error.response.status >= 500) {
        // @ts-expect-error - custom retry count
        config.__retryCount += 1;

        // Exponential backoff
        // @ts-expect-error - custom retry count
        const delay = RETRY_DELAY_MS * Math.pow(2, config.__retryCount - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));

        return instance(config);
      }

      return Promise.reject(error);
    }
  );

  return instance;
}

const api = createApiInstance();

/**
 * Initiate autocomplete - POST /completions
 */
export async function initiateAutocomplete(payload: PrewritePageData): Promise<AutofillResponse> {
  const response = await api.post<{ success: boolean; data: AutofillResponse }>('/completions', payload);
  return response.data.data;
}

/**
 * Subscribe to job completion via SSE - GET /events/subscribe/:jobId
 * Uses fetch instead of EventSource to support Authorization header
 */
export async function subscribeToJob(
  jobId: string,
  onMessage: (data: { status: 'completed' | 'failed'; error?: string }) => void,
  onError?: (error: Error) => void
): Promise<() => void> {
  const session = await getAuthSession();
  const abortController = new AbortController();

  const headers: HeadersInit = {
    'Accept': 'text/event-stream',
    'Cache-Control': 'no-cache',
  };

  if (session?.accessToken) {
    headers['Authorization'] = `Bearer ${session.accessToken}`;
  }

  try {
    const response = await fetch(`${BASE_URL}/events/subscribe/${jobId}`, {
      method: 'GET',
      headers,
      signal: abortController.signal,
    });

    if (!response.ok) {
      throw new Error(`SSE connection failed: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('SSE response has no body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    // Process stream
    const processStream = async () => {
      try {
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE messages (format: "data: {...}\n\n")
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const jsonStr = line.slice(6).trim();
                if (jsonStr) {
                  const data = JSON.parse(jsonStr);
                  onMessage(data);

                  // Close after receiving completion
                  if (data.status === 'completed' || data.status === 'failed') {
                    abortController.abort();
                    return;
                  }
                }
              } catch (e) {
                console.error('[Prewrite] SSE parse error:', e);
              }
            }
          }
        }
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          console.error('[Prewrite] SSE stream error:', e);
          onError?.(e as Error);
        }
      }
    };

    processStream();
  } catch (e) {
    console.error('[Prewrite] SSE connection error:', e);
    onError?.(e as Error);
  }

  // Return cleanup function
  return () => abortController.abort();
}

/**
 * Get completion result - GET /completions/result/:jobId
 */
export async function getCompletionResult(jobId: string): Promise<CompletionResult> {
  const response = await api.post<{ success: boolean; data: CompletionResult }>(`/completions/result/${jobId}`);
  return response.data.data;
}

/**
 * Check if API is healthy
 */
export async function healthCheck(): Promise<boolean> {
  try {
    await api.get('/health');
    return true;
  } catch {
    return false;
  }
}
