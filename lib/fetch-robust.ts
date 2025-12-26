
/**
 * ROBUST FETCH WRAPPER (v2.5)
 * 
 * Objective: Handle transient network failures and API intermittent downtime.
 */

export async function fetchWithRetry(
    url: string,
    options: RequestInit = {},
    retries: number = 3,
    backoff: number = 1000
): Promise<Response> {
    try {
        const response = await fetch(url, options);

        // If we get a 5xx or specific transient error, retry
        if (!response.ok && response.status >= 500 && retries > 0) {
            console.warn(`[RETRY] Server error ${response.status}. Retrying in ${backoff}ms... (${retries} left)`);
            await new Promise(resolve => setTimeout(resolve, backoff));
            return fetchWithRetry(url, options, retries - 1, backoff * 2);
        }

        return response;
    } catch (error) {
        if (retries > 0) {
            console.warn(`[RETRY] Network failure: ${error}. Retrying in ${backoff}ms... (${retries} left)`);
            await new Promise(resolve => setTimeout(resolve, backoff));
            return fetchWithRetry(url, options, retries - 1, backoff * 2);
        }
        throw error;
    }
}
