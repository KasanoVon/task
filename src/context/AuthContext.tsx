import React, { createContext, useContext, useReducer, useEffect } from 'react';
import type { User } from '../types';

interface AuthState {
  currentUser: User | null;
  token: string | null;
  initialized: boolean;
}

type AuthAction =
  | { type: 'LOGIN'; payload: { user: User; token: string } }
  | { type: 'LOGOUT' }
  | { type: 'LOAD'; payload: Pick<AuthState, 'currentUser' | 'token'> };

// ユーザー情報（機密ではない）のみ localStorage に保存。トークンは保存しない。
const USER_KEY = 'task_auth_user';
const API_BASE = import.meta.env.VITE_API_BASE ?? '';

function readCachedUser(): User | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<User>;
    if (!parsed.id || !parsed.username || !parsed.createdAt) return null;
    return { id: parsed.id, username: parsed.username, createdAt: parsed.createdAt };
  } catch {
    return null;
  }
}

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'LOGIN':
      return { ...state, currentUser: action.payload.user, token: action.payload.token, initialized: true };
    case 'LOGOUT':
      return { ...state, currentUser: null, token: null, initialized: true };
    case 'LOAD':
      return { ...state, currentUser: action.payload.currentUser, token: action.payload.token, initialized: true };
    default:
      return state;
  }
}

interface AuthContextValue {
  authState: AuthState;
  login: (username: string, password: string) => Promise<'ok' | 'invalid'>;
  register: (
    username: string,
    password: string
  ) => Promise<{ status: 'ok'; recoveryCode: string } | { status: 'taken' | 'server_error' }>;
  logout: () => void;
  resetPassword: (
    username: string,
    recoveryCode: string,
    newPassword: string
  ) => Promise<'ok' | 'invalid' | 'no_recovery_code' | 'server_error'>;
  setupRecoveryCode: () => Promise<{ status: 'ok'; recoveryCode: string } | { status: 'server_error' }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthSuccessResponse {
  user: User;
  token: string;
}

function buildAuthHeader(token: string | null): Record<string, string> {
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, dispatch] = useReducer(authReducer, {
    currentUser: null,
    token: null,
    initialized: false,
  });

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      const cachedUser = readCachedUser();
      if (cachedUser && active) {
        dispatch({ type: 'LOAD', payload: { currentUser: cachedUser, token: null } });
      }
      try {
        const res = await fetch(`${API_BASE}/api/auth/session`, { credentials: 'include' });
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem(USER_KEY);
          if (active) dispatch({ type: 'LOAD', payload: { currentUser: null, token: null } });
          return;
        }
        if (!res.ok) {
          if (!cachedUser && active) dispatch({ type: 'LOAD', payload: { currentUser: null, token: null } });
          return;
        }
        const data = (await res.json()) as { user: User };
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        if (active) dispatch({ type: 'LOAD', payload: { currentUser: data.user, token: null } });
      } catch {
        if (!cachedUser && active) dispatch({ type: 'LOAD', payload: { currentUser: null, token: null } });
      }
    }

    restoreSession();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!authState.initialized) return;
    if (authState.currentUser) {
      localStorage.setItem(USER_KEY, JSON.stringify(authState.currentUser));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  }, [authState.currentUser, authState.initialized]);

  async function login(username: string, password: string): Promise<'ok' | 'invalid'> {
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: username.trim(), password }),
      });
      if (!res.ok) return 'invalid';
      const data = (await res.json()) as AuthSuccessResponse;
      dispatch({ type: 'LOGIN', payload: data });
      return 'ok';
    } catch {
      return 'invalid';
    }
  }

  async function register(
    username: string,
    password: string
  ): Promise<{ status: 'ok'; recoveryCode: string } | { status: 'taken' | 'server_error' }> {
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: username.trim(), password }),
      });
      if (res.status === 409) return { status: 'taken' };
      if (!res.ok) return { status: 'server_error' };
      const data = (await res.json()) as AuthSuccessResponse & { recoveryCode: string };
      dispatch({ type: 'LOGIN', payload: data });
      return { status: 'ok', recoveryCode: data.recoveryCode };
    } catch {
      return { status: 'server_error' };
    }
  }

  function logout() {
    void fetch(`${API_BASE}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...buildAuthHeader(authState.token) },
    });
    dispatch({ type: 'LOGOUT' });
  }

  async function resetPassword(
    username: string,
    recoveryCode: string,
    newPassword: string
  ): Promise<'ok' | 'invalid' | 'no_recovery_code' | 'server_error'> {
    try {
      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: username.trim(), recoveryCode, newPassword }),
      });
      if (res.status === 404) return 'no_recovery_code';
      if (res.status === 401 || res.status === 400) return 'invalid';
      if (!res.ok) return 'server_error';
      return 'ok';
    } catch {
      return 'server_error';
    }
  }

  async function setupRecoveryCode(): Promise<
    { status: 'ok'; recoveryCode: string } | { status: 'server_error' }
  > {
    try {
      const res = await fetch(`${API_BASE}/api/auth/setup-recovery-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!res.ok) return { status: 'server_error' };
      const data = (await res.json()) as { recoveryCode: string };
      return { status: 'ok', recoveryCode: data.recoveryCode };
    } catch {
      return { status: 'server_error' };
    }
  }

  return (
    <AuthContext.Provider value={{ authState, login, register, logout, resetPassword, setupRecoveryCode }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
