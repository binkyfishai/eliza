/**
 * xAI Grok Build OAuth flow.
 *
 * This is a standalone first-party Eliza integration. It uses xAI OIDC
 * discovery, PKCE, and a loopback callback server; it does not read or depend
 * on any other app's credential store.
 */

import { createHash, randomBytes } from "node:crypto";
import { createServer, type Server } from "node:http";
import { logger } from "@elizaos/core";
import type { OAuthCredentials } from "./types.ts";

const ISSUER = "https://auth.x.ai";
const DISCOVERY_URL = `${ISSUER}/.well-known/openid-configuration`;
const CLIENT_ID =
  process.env.ELIZA_GROK_BUILD_OAUTH_CLIENT_ID?.trim() ||
  process.env.GROK_BUILD_OAUTH_CLIENT_ID?.trim() ||
  "b1a00492-073a-47ea-816f-4c329264a828";
const SCOPE =
  process.env.ELIZA_GROK_BUILD_OAUTH_SCOPE?.trim() ||
  process.env.GROK_BUILD_OAUTH_SCOPE?.trim() ||
  "openid profile email offline_access grok-cli:access api:access";
const CALLBACK_HOST =
  process.env.ELIZA_GROK_BUILD_CALLBACK_HOST?.trim() || "127.0.0.1";
const CALLBACK_PORT = Number.parseInt(
  process.env.ELIZA_GROK_BUILD_CALLBACK_PORT?.trim() || "56122",
  10,
);
const CALLBACK_PATH = "/callback";
const TOKEN_TIMEOUT_MS = 30_000;
const REFRESH_SKEW_MS = 120_000;

export interface GrokBuildFlow {
  authUrl: string;
  state: string;
  submitCode: (code: string) => void;
  credentials: Promise<OAuthCredentials>;
  close: () => void;
}

interface XaiDiscovery {
  authorizationEndpoint: string;
  tokenEndpoint: string;
}

interface CallbackResult {
  code?: string;
  state?: string;
  error?: string;
  errorDescription?: string;
}

function closeServer(server: Server): void {
  try {
    server.close();
  } catch (err) {
    logger.debug(`[grok-build] callback server already closed: ${String(err)}`);
  }
}

function base64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

function generatePkce(): { verifier: string; challenge: string } {
  const verifier = base64Url(randomBytes(32));
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

function validateXaiEndpoint(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`xAI OIDC discovery did not include ${field}`);
  }
  const url = new URL(value);
  if (url.protocol !== "https:") {
    throw new Error(`xAI OAuth ${field} must use HTTPS`);
  }
  const host = url.hostname.toLowerCase();
  if (
    host !== "x.ai" &&
    host !== "auth.x.ai" &&
    host !== "accounts.x.ai" &&
    !host.endsWith(".x.ai")
  ) {
    throw new Error(`Refusing non-xAI OAuth ${field}: ${value}`);
  }
  return url.toString();
}

async function discover(): Promise<XaiDiscovery> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(DISCOVERY_URL, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`xAI OIDC discovery returned HTTP ${response.status}`);
    }
    const payload = (await response.json()) as Record<string, unknown>;
    return {
      authorizationEndpoint: validateXaiEndpoint(
        payload.authorization_endpoint,
        "authorization_endpoint",
      ),
      tokenEndpoint: validateXaiEndpoint(
        payload.token_endpoint,
        "token_endpoint",
      ),
    };
  } finally {
    clearTimeout(timer);
  }
}

function parseAuthorizationInput(input: string): CallbackResult {
  const value = input.trim();
  if (!value) return {};
  try {
    const url = new URL(value);
    return {
      code: url.searchParams.get("code") ?? undefined,
      state: url.searchParams.get("state") ?? undefined,
      error: url.searchParams.get("error") ?? undefined,
      errorDescription:
        url.searchParams.get("error_description") ?? undefined,
    };
  } catch {
    /* not a URL */
  }
  if (value.startsWith("?") || value.includes("code=")) {
    const params = new URLSearchParams(value.replace(/^\?/, ""));
    return {
      code: params.get("code") ?? undefined,
      state: params.get("state") ?? undefined,
      error: params.get("error") ?? undefined,
      errorDescription: params.get("error_description") ?? undefined,
    };
  }
  return { code: value };
}

async function startCallbackServer(): Promise<{
  server: Server;
  redirectUri: string;
  waitForCallback: Promise<CallbackResult>;
}> {
  let resolveCallback!: (result: CallbackResult) => void;
  const waitForCallback = new Promise<CallbackResult>((resolve) => {
    resolveCallback = resolve;
  });

  const server = createServer((req, res) => {
    try {
      const origin = req.headers.origin;
      if (origin === "https://accounts.x.ai" || origin === "https://auth.x.ai") {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        res.setHeader("Access-Control-Allow-Private-Network", "true");
        res.setHeader("Vary", "Origin");
      }
      if (req.method === "OPTIONS") {
        res.statusCode = 204;
        res.end();
        return;
      }

      const url = new URL(req.url ?? "/", `http://${CALLBACK_HOST}`);
      if (url.pathname !== CALLBACK_PATH) {
        res.statusCode = 404;
        res.end("Not found");
        return;
      }

      const result: CallbackResult = {
        code: url.searchParams.get("code") ?? undefined,
        state: url.searchParams.get("state") ?? undefined,
        error: url.searchParams.get("error") ?? undefined,
        errorDescription:
          url.searchParams.get("error_description") ?? undefined,
      };
      res.statusCode = result.error ? 400 : 200;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(
        result.error
          ? "<html><body><h1>xAI authorization failed.</h1>You can close this tab.</body></html>"
          : "<html><body><h1>xAI authorization received.</h1>You can close this tab.</body></html>",
      );
      resolveCallback(result);
    } catch {
      res.statusCode = 500;
      res.end("Internal error");
    }
  });

  const listen = (port: number) =>
    new Promise<number>((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, CALLBACK_HOST, () => {
        server.removeListener("error", reject);
        const addr = server.address();
        resolve(typeof addr === "object" && addr ? addr.port : port);
      });
    });

  let actualPort: number;
  try {
    actualPort = await listen(
      Number.isFinite(CALLBACK_PORT) ? CALLBACK_PORT : 56122,
    );
  } catch (firstErr) {
    logger.warn(
      `[grok-build] default callback port unavailable, using ephemeral port: ${String(firstErr)}`,
    );
    actualPort = await listen(0);
  }

  return {
    server,
    redirectUri: `http://${CALLBACK_HOST}:${actualPort}${CALLBACK_PATH}`,
    waitForCallback,
  };
}

async function fetchTokenResponse(
  tokenEndpoint: string,
  body: URLSearchParams,
  label: string,
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TOKEN_TIMEOUT_MS);
  try {
    const response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
      signal: controller.signal,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`xAI ${label} failed: ${response.status} ${text}`);
    }
    return (await response.json()) as Record<string, unknown>;
  } finally {
    clearTimeout(timer);
  }
}

function credentialsFromTokenPayload(payload: Record<string, unknown>): OAuthCredentials {
  const access = typeof payload.access_token === "string" ? payload.access_token : "";
  const refresh =
    typeof payload.refresh_token === "string" ? payload.refresh_token : "";
  const expiresIn =
    typeof payload.expires_in === "number"
      ? payload.expires_in
      : Number(payload.expires_in ?? 3600);
  if (!access) throw new Error("xAI token response did not include access_token");
  if (!refresh) throw new Error("xAI token response did not include refresh_token");
  return {
    access,
    refresh,
    expires: Date.now() + expiresIn * 1000 - REFRESH_SKEW_MS,
  };
}

async function exchangeCode(args: {
  tokenEndpoint: string;
  code: string;
  redirectUri: string;
  verifier: string;
}): Promise<OAuthCredentials> {
  const payload = await fetchTokenResponse(
    args.tokenEndpoint,
    new URLSearchParams({
      grant_type: "authorization_code",
      client_id: CLIENT_ID,
      code: args.code,
      redirect_uri: args.redirectUri,
      code_verifier: args.verifier,
    }),
    "token exchange",
  );
  return credentialsFromTokenPayload(payload);
}

export async function refreshGrokBuildToken(
  refreshToken: string,
): Promise<OAuthCredentials> {
  const discovery = await discover();
  const payload = await fetchTokenResponse(
    discovery.tokenEndpoint,
    new URLSearchParams({
      grant_type: "refresh_token",
      client_id: CLIENT_ID,
      refresh_token: refreshToken,
    }),
    "token refresh",
  );
  const refreshed = credentialsFromTokenPayload({
    ...payload,
    refresh_token: payload.refresh_token ?? refreshToken,
  });
  return refreshed;
}

export async function startGrokBuildLogin(): Promise<GrokBuildFlow> {
  const discovery = await discover();
  const { verifier, challenge } = generatePkce();
  const state = base64Url(randomBytes(16));
  const nonce = base64Url(randomBytes(16));
  const callback = await startCallbackServer();

  let resolveManual!: (input: string) => void;
  const manualInput = new Promise<string>((resolve) => {
    resolveManual = resolve;
  });

  const authUrl = new URL(discovery.authorizationEndpoint);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", callback.redirectUri);
  authUrl.searchParams.set("scope", SCOPE);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("nonce", nonce);
  authUrl.searchParams.set("plan", "generic");
  authUrl.searchParams.set("referrer", "eliza");

  const credentials = (async () => {
    try {
      const result = await Promise.race([
        callback.waitForCallback,
        manualInput.then(parseAuthorizationInput),
      ]);
      if (result.error) {
        throw new Error(result.errorDescription ?? result.error);
      }
      if (result.state && result.state !== state) {
        throw new Error("xAI OAuth state mismatch");
      }
      if (!result.code) {
        throw new Error("xAI OAuth did not return an authorization code");
      }
      return await exchangeCode({
        tokenEndpoint: discovery.tokenEndpoint,
        code: result.code,
        redirectUri: callback.redirectUri,
        verifier,
      });
    } finally {
      closeServer(callback.server);
    }
  })();

  return {
    authUrl: authUrl.toString(),
    state,
    submitCode: (code: string) => resolveManual(code),
    credentials,
    close: () => {
      resolveManual("");
      closeServer(callback.server);
    },
  };
}
