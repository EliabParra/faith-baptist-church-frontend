import { Injectable } from '@angular/core'
import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http'
import { firstValueFrom } from 'rxjs'
import type { ApiResult, ToProccessBody } from './api.types'

@Injectable({ providedIn: 'root' })
export class ApiService {
  private csrfToken: string | null = null

  constructor(private http: HttpClient) {}

  async ensureCsrf(): Promise<string> {
    if (this.csrfToken) return this.csrfToken

    // Relative URL on purpose: the dev proxy forwards it to the backend.
    const data: any = await firstValueFrom(
      this.http.get('/csrf', {
        // Keep explicit works both with proxy and with cross-origin setups.
        withCredentials: true,
      })
    )

    // Backend may return { csrfToken } (current) or { token } (older docs/examples).
    this.csrfToken = data?.csrfToken ?? data?.token ?? null

    if (!this.csrfToken) {
      throw {
        code: 'csrfMissing',
        msg: 'CSRF token missing from /csrf response (expected csrfToken/token)',
        raw: data,
      }
    }

    return this.csrfToken
  }

  private async postJson(path: string, body: any): Promise<ApiResult<any>> {
    const token = await this.ensureCsrf()

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'X-CSRF-Token': token,
    })

    // Observe full response so we can read status codes if needed.
    const res = await firstValueFrom(
      this.http.post(path, body, {
        headers,
        withCredentials: true,
        observe: 'response',
      })
    )

    return this.normalizeResponse(res)
  }

  private normalizeResponse(res: HttpResponse<any>): ApiResult<any> {
    // With Angular HttpClient, non-2xx normally throws. If we get here, it was 2xx.
    return res.body
  }

  // Public API
  async login(user: string, pass: string) {
    return this.postJson('/login', { username: user, password: pass })
  }

  async logout() {
    // Some backends may allow logout without CSRF but your backend requires it.
    return this.postJson('/logout', {})
  }

  async toProccess(tx: number, params: object | string | number | null | undefined) {
    const body: ToProccessBody = { tx, params }
    return this.postJson('/toProccess', body)
  }

  // Helper to reset token (useful when you clear cookies during dev)
  resetCsrf() {
    this.csrfToken = null
  }

  // When HttpClient throws on non-2xx, this helper converts it into ApiResult.
  static toApiError(e: any): ApiResult<any> {
    const errBody = e?.error
    if (errBody) return { ok: false, error: errBody }

    // Preserve custom thrown objects like {code, msg}.
    if (e?.code && e?.msg) {
      return { ok: false, error: e }
    }

    // Angular network errors often come as status=0 with a ProgressEvent.
    const status = e?.status
    const url = e?.url
    const isNetwork = status === 0

    return {
      ok: false,
      error: {
        code: 'networkOrUnknown',
        msg: isNetwork
          ? 'Network error (status 0). Check: backend running, proxy enabled, correct port.'
          : (e?.message ?? 'Request failed'),
        status,
        url,
        details: isNetwork ? (e?.error?.type ?? e?.error ?? null) : null,
      },
    }
  }
}
