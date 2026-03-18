import { Buffer } from "node:buffer";

import { SockShopClient, sockShopClient } from "./client.js";
import type { Customer } from "./types.js";

export interface SessionState {
  isLoggedIn: boolean;
  customerId: string | null;
  username: string | null;
  cookies: {
    mdSid: boolean;
    loggedIn: boolean;
  };
}

interface LoginIdentity {
  customerId: string | null;
  username: string | null;
}

interface RegisterResponse {
  id?: string;
  username?: string;
}

const MD_SID_COOKIE_NAME = "md.sid";
const LOGGED_IN_COOKIE_NAME = "logged_in";

export class SockShopAuth {
  private identity: LoginIdentity = {
    customerId: null,
    username: null,
  };

  constructor(
    private readonly client: SockShopClient,
    private readonly env: NodeJS.ProcessEnv = process.env,
  ) {}

  async login(
    username = this.env.SOCKSHOP_USERNAME,
    password = this.env.SOCKSHOP_PASSWORD,
  ): Promise<SessionState> {
    if (!username || !password) {
      throw new Error(
        "SOCKSHOP_USERNAME and SOCKSHOP_PASSWORD must be set before logging in.",
      );
    }

    const authorization = `Basic ${Buffer.from(
      `${username}:${password}`,
      "utf8",
    ).toString("base64")}`;

    // Reuse the existing jar so an anonymous md.sid survives login for cart merge.
    const response = await this.client.get<unknown>("/login", {
      headers: {
        Authorization: authorization,
      },
    });

    this.assertAuthenticatedCookies();

    const identity = this.parseLoginIdentity(response, username);
    if (identity.customerId && identity.username) {
      this.identity = identity;
    } else {
      await this.hydrateIdentityFromSession(username);
    }

    return this.getSessionState();
  }

  async register(
    username: string,
    password: string,
    email: string,
    firstName: string,
    lastName: string,
  ): Promise<SessionState> {
    const response = await this.client.post<RegisterResponse, Record<string, string>>(
      "/register",
      {
        username,
        password,
        email,
        firstName,
        lastName,
      },
    );

    this.assertAuthenticatedCookies();

    this.identity = {
      customerId: this.getStringProperty(response, "id") ?? null,
      username: this.getStringProperty(response, "username") ?? username,
    };

    if (!this.identity.customerId || !this.identity.username) {
      await this.hydrateIdentityFromSession(username);
    }

    return this.getSessionState();
  }

  async ensureLoggedIn(): Promise<SessionState> {
    if (!this.isAuthenticated()) {
      return this.login();
    }

    if (!this.identity.customerId || !this.identity.username) {
      try {
        await this.hydrateIdentityFromSession(this.env.SOCKSHOP_USERNAME ?? null);
      } catch {
        return this.login();
      }
    }

    return this.getSessionState();
  }

  getSessionState(): SessionState {
    const cookies = this.getCookieFlags();

    if (!cookies.loggedIn) {
      return {
        isLoggedIn: false,
        customerId: null,
        username: null,
        cookies,
      };
    }

    return {
      isLoggedIn: true,
      customerId: this.identity.customerId,
      username: this.identity.username,
      cookies,
    };
  }

  isAuthenticated(): boolean {
    return this.getCookieFlags().loggedIn;
  }

  private getCookieFlags(): SessionState["cookies"] {
    return {
      mdSid: Boolean(this.client.getCookieValueSync("/", MD_SID_COOKIE_NAME)),
      loggedIn: Boolean(this.client.getCookieValueSync("/", LOGGED_IN_COOKIE_NAME)),
    };
  }

  private assertAuthenticatedCookies(): void {
    const cookies = this.getCookieFlags();
    if (!cookies.loggedIn || !cookies.mdSid) {
      throw new Error(
        "Authentication completed without establishing both md.sid and logged_in cookies.",
      );
    }
  }

  private parseLoginIdentity(
    response: unknown,
    fallbackUsername: string,
  ): LoginIdentity {
    if (!response || typeof response !== "object") {
      return {
        customerId: null,
        username: fallbackUsername,
      };
    }

    const user = this.getObjectProperty(response, "user");
    const customerId =
      this.getStringProperty(user, "id") ?? this.getStringProperty(response, "id");
    const username =
      this.getStringProperty(user, "username") ??
      this.getStringProperty(response, "username") ??
      fallbackUsername;

    return {
      customerId: customerId ?? null,
      username: username ?? null,
    };
  }

  private async hydrateIdentityFromSession(
    fallbackUsername: string | null,
  ): Promise<void> {
    const sessionLookupId =
      this.client.getCookieValueSync("/", LOGGED_IN_COOKIE_NAME) ?? "me";
    const customer = await this.client.get<Customer>(
      `/customers/${encodeURIComponent(sessionLookupId)}`,
    );

    this.identity = {
      customerId: customer.id,
      username: customer.username || fallbackUsername,
    };
  }

  private getObjectProperty(
    value: unknown,
    propertyName: string,
  ): Record<string, unknown> | undefined {
    if (!value || typeof value !== "object") {
      return undefined;
    }

    const property = (value as Record<string, unknown>)[propertyName];
    if (!property || typeof property !== "object") {
      return undefined;
    }

    return property as Record<string, unknown>;
  }

  private getStringProperty(
    value: unknown,
    propertyName: string,
  ): string | undefined {
    if (!value || typeof value !== "object") {
      return undefined;
    }

    const property = (value as Record<string, unknown>)[propertyName];
    return typeof property === "string" ? property : undefined;
  }
}

export const sockShopAuth = new SockShopAuth(sockShopClient);
