// Tiny fetch wrapper around the backend REST API.
// - Reads the base URL from VITE_API_URL (falls back to localhost).
// - Attaches the stored JWT as a Bearer token.
// - Retries automatically while a sleeping free-tier server wakes up.
// - Parses JSON and throws a useful Error on non-2xx responses.

const BASE_URL =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000/api";

const TOKEN_KEY = "mpm-token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Retry on network failures and gateway errors (502/503/504) — these happen
// while a free-tier host (e.g. Render) is spinning the server back up. A cold
// start of a Node app can take well over a minute, so the schedule now spans
// ~2.5 minutes to ride out even a slow wake-up instead of failing early.
const RETRY_WAITS = [1500, 3000, 5000, 8000, 10000, 12000, 15000, 15000, 20000, 20000, 25000, 25000]; // ms between attempts (~2.5 min total)
const MAX_RETRIES = RETRY_WAITS.length;
const RETRYABLE = [502, 503, 504];

// Optional hook so the UI can show "waking the server up…" progress during a
// long cold-start retry sequence. Set via api.onRetry.
let retryListener = null;

async function request(path, { method = "GET", body, auth = true, headers = {} } = {}) {
  const finalHeaders = { ...headers };
  let payload = body;

  const isFormData = body instanceof FormData;
  if (body !== undefined && !isFormData) {
    finalHeaders["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  if (auth) {
    const token = getToken();
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
  }

  let lastNetworkError = false;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let res;
    try {
      res = await fetch(`${BASE_URL}${path}`, { method, headers: finalHeaders, body: payload });
    } catch {
      lastNetworkError = true;
      if (attempt < MAX_RETRIES) {
        retryListener?.(attempt + 1, MAX_RETRIES); // notify UI: still waking up
        await sleep(RETRY_WAITS[attempt]); // give the server time to wake up
        continue;
      }
      break;
    }

    // Gateway/cold-start errors → wait and retry
    if (RETRYABLE.includes(res.status) && attempt < MAX_RETRIES) {
      retryListener?.(attempt + 1, MAX_RETRIES);
      await sleep(RETRY_WAITS[attempt]);
      continue;
    }

    const text = await res.text();
    const data = text ? safeJson(text) : null;
    if (!res.ok) {
      const message = data?.message || `Request failed (${res.status})`;
      const err = new Error(message);
      err.status = res.status;
      err.data = data; // full response body (e.g. { needsVerification, email })

      // If the server says the token is invalid/expired, clear local auth state
      // and redirect to login so the user isn't stuck in a broken session.
      if (res.status === 401 && auth) {
        clearToken();
        localStorage.removeItem("mpm-user");
        // Only redirect if we're not already on an auth page (avoid loops).
        const hash = window.location.hash || "";
        const isAuthPage = /^\#?\/(login|register|forgot-password|admin\/login|client\/register)/.test(hash);
        if (!isAuthPage) {
          window.location.hash = "#/login";
        }
      }

      throw err;
    }
    return data;
  }

  throw new Error(
    lastNetworkError
      ? "Cannot reach the server. It may be waking up from sleep — please wait a moment and try again."
      : "The server is starting up. Please try again in a few seconds."
  );
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export const api = {
  get: (path, opts) => request(path, { ...opts, method: "GET" }),
  post: (path, body, opts) => request(path, { ...opts, method: "POST", body }),
  put: (path, body, opts) => request(path, { ...opts, method: "PUT", body }),
  patch: (path, body, opts) => request(path, { ...opts, method: "PATCH", body }),
  del: (path, opts) => request(path, { ...opts, method: "DELETE" }),
  baseUrl: BASE_URL,
  // Register a callback fired on each cold-start retry: (attempt, max) => void.
  onRetry: (fn) => { retryListener = fn; },
};
