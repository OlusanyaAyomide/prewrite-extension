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

/**
 * Poll for job completion - GET /completions/result/:jobId
 * Retries until successful response or timeout
 */
export async function pollJobResult(
  jobId: string,
  intervalMs = 15000,
  maxAttempts = 8
): Promise<CompletionResult> {
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      // Try to get the result
      const result = await getCompletionResult(jobId);

      // Only return if overall_match is a number (job complete)
      if (typeof result.overall_match === 'number') {
        return result;
      }
    } catch (error) {
      // If error is 404 (Not Found) or 202 (Accepted), continue polling
      // Otherwise, log error but maybe retry anyway?
      // For now, we assume any error means not ready or temporary failure

      // Check if it's a permanent error? 
      // Assuming 404 means 'not ready yet'
    }

    attempts++;
    // Wait before next attempt
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new Error('Timeout waiting for job completion');
}

/**
 * Get completion result - GET /completions/result/:jobId
 */
export async function getCompletionResult(jobId: string): Promise<CompletionResult> {
  const response = await api.get<{ success: boolean; data: CompletionResult }>(`/completions/result/${jobId}`);
  return response.data.data;
}

/**
 * Force apply for a job
 */
export async function forceApply(completionsReference: string, jobReference: string): Promise<CompletionResult> {
  const response = await api.post<{ success: boolean; data: { job_id: string } }>('/completions/force-apply', {
    completions_reference: completionsReference,
    job_reference: jobReference
  });

  const newJobId = response.data.data.job_id;
  return pollJobResult(newJobId);
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
