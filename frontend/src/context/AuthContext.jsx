import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { authService } from "../services";
import { setToken, clearToken, getToken } from "../lib/api";

const AuthContext = createContext();

const initials = (s = "") =>
  s.trim().split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();

// Real auth backed by the API. The JWT is stored via the api layer and the
// user profile is cached in localStorage for instant first paint, then
// revalidated against /auth/me on load.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("mpm-user");
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(!!getToken());

  const persist = useCallback((u) => {
    if (u) {
      const profile = { ...u, avatar: u.avatar || initials(u.name || u.email) };
      localStorage.setItem("mpm-user", JSON.stringify(profile));
      setUser(profile);
      return profile;
    }
    localStorage.removeItem("mpm-user");
    setUser(null);
    return null;
  }, []);

  // Revalidate the session on first load if a token exists.
  useEffect(() => {
    if (!getToken()) return;
    let active = true;
    authService
      .me()
      .then((res) => active && persist(res.user))
      .catch(() => {
        clearToken();
        active && persist(null);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [persist]);

  const login = async (email, password) => {
    const { user: u, token } = await authService.login(email, password);
    setToken(token);
    return persist(u);
  };

  const register = async (name, email, password) => {
    const { user: u, token } = await authService.register(name, email, password);
    if (token) setToken(token);
    return persist(u);
  };

  const loginWithGoogle = async (profile) => {
    const { user: u, token } = await authService.google(profile);
    setToken(token);
    return persist(u);
  };

  const logout = () => {
    clearToken();
    persist(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, loginWithGoogle, logout, isAuthenticated: !!user }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}
