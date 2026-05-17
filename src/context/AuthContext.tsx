/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiRequest } from "@/lib/api";

type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  status: "active" | "inactive" | "banned";
  createdAt?: string;
};

type AuthResponse = {
  success: boolean;
  message: string;
  token: string;
  user: AuthUser;
};

type UpdateProfilePayload = {
  name: string;
  email: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (name: string, email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
  refreshProfile: () => Promise<AuthUser | null>;
  updateProfile: (payload: UpdateProfilePayload) => Promise<AuthUser>;
};

type StoredAuth = {
  token: string | null;
  user: AuthUser | null;
};

const AUTH_TOKEN_STORAGE_KEY = "token";
const AUTH_USER_STORAGE_KEY = "snekx-user";
const LEGACY_AUTH_STORAGE_KEY = "snekx-auth";

const readStoredUser = () => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(AUTH_USER_STORAGE_KEY);
    if (!rawValue) {
      return null;
    }

    return JSON.parse(rawValue) as AuthUser;
  } catch {
    return null;
  }
};

const readLegacyStoredAuth = (): StoredAuth => {
  if (typeof window === "undefined") {
    return { token: null, user: null };
  }

  try {
    const rawValue = window.localStorage.getItem(LEGACY_AUTH_STORAGE_KEY);
    if (!rawValue) {
      return { token: null, user: null };
    }

    const parsedValue = JSON.parse(rawValue) as StoredAuth;
    return {
      token: parsedValue.token || null,
      user: parsedValue.user || null,
    };
  } catch {
    return { token: null, user: null };
  }
};

const readStoredAuth = (): StoredAuth => {
  if (typeof window === "undefined") {
    return { token: null, user: null };
  }

  const token = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  const user = readStoredUser();

  if (token) {
    return { token, user };
  }

  const legacyAuth = readLegacyStoredAuth();
  if (legacyAuth.token) {
    window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, legacyAuth.token);

    if (legacyAuth.user) {
      window.localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(legacyAuth.user));
    }

    window.localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
  }

  return legacyAuth;
};

const writeStoredAuth = (value: StoredAuth) => {
  if (typeof window === "undefined") {
    return;
  }

  if (value.token) {
    window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, value.token);
  } else {
    window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  }

  if (value.user) {
    window.localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(value.user));
  } else {
    window.localStorage.removeItem(AUTH_USER_STORAGE_KEY);
  }

  window.localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
};

const clearStoredAuth = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(AUTH_USER_STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const saveSession = (nextToken: string, nextUser: AuthUser) => {
    setToken(nextToken);
    setUser(nextUser);
    writeStoredAuth({ token: nextToken, user: nextUser });
  };

  const clearSession = () => {
    setToken(null);
    setUser(null);
    clearStoredAuth();
  };

  useEffect(() => {
    let isCancelled = false;

    const initializeAuth = async () => {
      const storedAuth = readStoredAuth();

      if (!storedAuth.token) {
        setIsLoading(false);
        return;
      }

      setToken(storedAuth.token);

      if (storedAuth.user) {
        setUser(storedAuth.user);
      }

      try {
        const response = await apiRequest<{ success: boolean; user: AuthUser }>("/api/auth/profile", {
          method: "GET",
          token: storedAuth.token,
        });

        if (!isCancelled) {
          saveSession(storedAuth.token, response.user);
        }
      } catch {
        if (!isCancelled) {
          clearSession();
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      isCancelled = true;
    };
  }, []);

  const login = async (email: string, password: string) => {
    const response = await apiRequest<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: { email, password },
    });

    saveSession(response.token, response.user);
    return response.user;
  };

  const register = async (name: string, email: string, password: string) => {
    const response = await apiRequest<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: { name, email, password },
    });

    saveSession(response.token, response.user);
    return response.user;
  };

  const refreshProfile = async () => {
    if (!token) {
      clearSession();
      return null;
    }

    const response = await apiRequest<{ success: boolean; user: AuthUser }>("/api/auth/profile", {
      method: "GET",
      token,
    });

    saveSession(token, response.user);
    return response.user;
  };

  const updateProfile = async (payload: UpdateProfilePayload) => {
    if (!token) {
      throw new Error("Authentication is required.");
    }

    const response = await apiRequest<{ success: boolean; user: AuthUser }>("/api/auth/profile", {
      method: "PATCH",
      body: payload,
      token,
    });

    saveSession(token, response.user);
    return response.user;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: Boolean(user && token),
        isLoading,
        login,
        register,
        logout: clearSession,
        refreshProfile,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
};
