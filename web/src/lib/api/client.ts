import { config } from '@/config'

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

class ApiClient {
  private baseUrl: string
  private token: string | null = null
  private fetchFn: typeof globalThis.fetch = globalThis.fetch.bind(globalThis)

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
  }

  setToken(token: string) {
    this.token = token
  }

  clearToken() {
    this.token = null
  }

  /**
   * Replace the underlying fetch implementation. Pass an x402-wrapped fetch
   * when a wallet is connected so paid endpoints are handled automatically.
   * Pass null to revert to the native fetch.
   */
  setFetch(fn: typeof globalThis.fetch | null) {
    this.fetchFn = fn ?? globalThis.fetch.bind(globalThis)
  }

  private headers(): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }
    return headers
  }

  async get<T>(
    path: string,
    params?: Record<string, string | undefined>,
    timeout = 30_000,
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`)
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, value)
        }
      }
    }
    const controller = new AbortController()
    const timeout_id = setTimeout(() => controller.abort(), timeout)
    try {
      const res = await this.fetchFn(url.toString(), {
        method: 'GET',
        headers: this.headers(),
        signal: controller.signal,
      })
      if (!res.ok) {
        throw new ApiError(res.status, `GET ${path} failed: ${res.statusText}`)
      }
      return res.json() as Promise<T>
    } catch (err) {
      if (err instanceof ApiError) throw err
      if ((err as Error).name === 'AbortError') {
        throw new ApiError(0, `GET ${path} timed out after ${timeout / 1_000}s`)
      }
      throw err
    } finally {
      clearTimeout(timeout_id)
    }
  }

  async post<T>(path: string, body?: unknown, timeout = 30_000): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`)
    const controller = new AbortController()
    const timeout_id = setTimeout(() => controller.abort(), timeout)
    try {
      const res = await this.fetchFn(url.toString(), {
        method: 'POST',
        headers: this.headers(),
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })
      if (!res.ok) {
        let message = res.statusText
        try {
          const json = await res.json()
          message = json?.error?.message || json?.message || res.statusText
        } catch {
          message = await res.text().catch(() => res.statusText)
        }
        throw new ApiError(res.status, `POST ${path} failed: ${message}`)
      }
      return res.json() as Promise<T>
    } catch (err) {
      if (err instanceof ApiError) throw err
      if ((err as Error).name === 'AbortError') {
        throw new ApiError(
          0,
          `POST ${path} timed out after ${timeout / 1_000}s`,
        )
      }
      throw err
    } finally {
      clearTimeout(timeout_id)
    }
  }
}

export const apiClient = new ApiClient(config.apiUrl)
export { ApiError }
