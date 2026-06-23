// Tiny fetch wrapper around the backend REST API.
// - Reads the base URL from VITE_API_URL (falls back to localhost).
// - Attaches the stored JWT as a Bearer token.
// - Parses JSON and throws a useful Error on non-2xx responses.

const BASE_URL =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000/api";

const TOKEN_KEY = "mpm-token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

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

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, { method, headers: finalHeaders, body: payload });
  } catch {
    throw new Error("Cannot reach the server. Is the backend running?");
  }

  const text = await res.text();
  const data = text ? safeJson(text) : null;

  if (!res.ok) {
    const message = data?.message || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return data;
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
};
