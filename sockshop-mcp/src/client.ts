import { CookieJar, type Cookie } from "tough-cookie";

export interface RequestOptions {
  headers?: HeadersInit;
}

const DEFAULT_BASE_URL = "http://localhost:8888";

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

export class SockShopClient {
  readonly baseUrl: string;
  readonly cookieJar: CookieJar;
  private readonly fetchImpl: typeof fetch;

  constructor(options?: {
    baseUrl?: string;
    cookieJar?: CookieJar;
    fetchImpl?: typeof fetch;
  }) {
    this.baseUrl = normalizeBaseUrl(
      options?.baseUrl ?? process.env.SOCKSHOP_BASE_URL ?? DEFAULT_BASE_URL,
    );
    this.cookieJar = options?.cookieJar ?? new CookieJar();
    this.fetchImpl = options?.fetchImpl ?? fetch;
  }

  async get<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>("GET", path, undefined, options);
  }

  async post<T, TBody = unknown>(
    path: string,
    body?: TBody,
    options: RequestOptions = {},
  ): Promise<T> {
    return this.request<T>("POST", path, body, options);
  }

  async del<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>("DELETE", path, undefined, options);
  }

  async getCookies(path = "/"): Promise<Cookie[]> {
    return this.cookieJar.getCookies(this.resolveUrl(path));
  }

  getCookiesSync(path = "/"): Cookie[] {
    return this.cookieJar.getCookiesSync(this.resolveUrl(path).toString());
  }

  async getCookieValue(path: string, name: string): Promise<string | undefined> {
    const cookies = await this.getCookies(path);
    return cookies.find((cookie) => cookie.key === name)?.value;
  }

  getCookieValueSync(path: string, name: string): string | undefined {
    const cookies = this.getCookiesSync(path);
    return cookies.find((cookie) => cookie.key === name)?.value;
  }

  private async request<T>(
    method: "GET" | "POST" | "DELETE",
    path: string,
    body?: unknown,
    options: RequestOptions = {},
  ): Promise<T> {
    const url = this.resolveUrl(path);
    const headers = new Headers(options.headers);
    const cookieHeader = await this.cookieJar.getCookieString(url.toString());

    if (cookieHeader) {
      headers.set("Cookie", cookieHeader);
    }

    let requestBody: string | undefined;
    if (body !== undefined) {
      if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
      requestBody = JSON.stringify(body);
    }

    const response = await this.fetchImpl(url, {
      method,
      headers,
      body: requestBody,
    });

    await this.storeResponseCookies(url, response);

    const text = response.status === 204 ? "" : await response.text();
    if (!response.ok) {
      throw new Error(
        `${method} ${url.toString()} failed with ${response.status}${
          text ? `: ${text}` : ""
        }`,
      );
    }

    if (!text) {
      return undefined as T;
    }

    return this.parseResponseBody<T>(text);
  }

  private parseResponseBody<T>(text: string): T {
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as T;
    }
  }

  private async storeResponseCookies(url: URL, response: Response): Promise<void> {
    const setCookies =
      typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : this.getLegacySetCookieHeader(response.headers);

    for (const cookie of setCookies) {
      await this.cookieJar.setCookie(cookie, url);
    }
  }

  private getLegacySetCookieHeader(headers: Headers): string[] {
    const setCookie = headers.get("set-cookie");
    return setCookie ? [setCookie] : [];
  }

  private resolveUrl(path: string): URL {
    if (/^https?:\/\//i.test(path)) {
      return new URL(path);
    }

    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return new URL(normalizedPath, `${this.baseUrl}/`);
  }
}

export const sockShopClient = new SockShopClient();
