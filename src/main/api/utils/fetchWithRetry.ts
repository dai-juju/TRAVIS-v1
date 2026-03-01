// ============================================================
// fetchWithRetry — HTTP 요청 재시도 유틸리티
// CoinGecko 등 외부 API의 일시적 오류(429, 5xx)에 대응
// 지수 백오프(exponential backoff)로 재시도 간격을 늘려감
// ============================================================

interface RetryOptions {
  maxRetries?: number      // 기본 2회 (총 3회 시도)
  baseDelay?: number       // 기본 1000ms
  maxDelay?: number        // 최대 5000ms
  retryOnStatus?: number[] // 재시도할 HTTP 상태 코드
}

export async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  retryOptions?: RetryOptions
): Promise<Response> {
  const {
    maxRetries = 2,
    baseDelay = 1000,
    maxDelay = 5000,
    retryOnStatus = [429, 500, 502, 503, 504],
  } = retryOptions || {}

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options)

      if (retryOnStatus.includes(response.status) && attempt < maxRetries) {
        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay)
        console.warn(`[fetchWithRetry] ${url} returned ${response.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }

      return response
    } catch (error) {
      lastError = error as Error
      if (attempt < maxRetries) {
        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay)
        console.warn(`[fetchWithRetry] ${url} failed, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries}):`, error)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError || new Error(`fetchWithRetry failed after ${maxRetries + 1} attempts`)
}
