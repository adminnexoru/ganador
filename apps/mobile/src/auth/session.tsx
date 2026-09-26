import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { api, ApiError, tokenStore } from '@/api/client';
import type { Tokens, User } from '@/api/types';

type Status = 'loading' | 'signedOut' | 'needsConsent' | 'ready';

type SessionValue = {
  status: Status;
  user: User | null;
  signIn: (tokens: Tokens, user: User, needsConsent: boolean) => Promise<void>;
  consentAccepted: () => Promise<void>;
  setUser: (user: User) => void;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

/** Recupera la sesión guardada al abrir la app. */
async function restoreSession(): Promise<{ status: Status; user: User | null }> {
  if (!(await tokenStore.hasRefreshToken())) return { status: 'signedOut', user: null };
  try {
    const user = await api<User>('/me');
    try {
      // /me no exige consentimiento; se verifica con una ruta que sí lo exige.
      await api('/pets');
      return { status: 'ready', user };
    } catch (e) {
      if (e instanceof ApiError && e.code === 'consent_required') return { status: 'needsConsent', user };
      return { status: 'ready', user };
    }
  } catch (e) {
    // Sin conexión se entra con los datos guardados en el celular (M1); solo un 401 cierra sesión.
    if (e instanceof ApiError && e.status === 401) return { status: 'signedOut', user: null };
    return { status: 'ready', user: null };
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    tokenStore.onSignedOut(() => {
      setUser(null);
      setStatus('signedOut');
    });
    void restoreSession().then((r) => {
      setUser(r.user);
      setStatus(r.status);
    });
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      status,
      user,
      async signIn(tokens, u, needsConsent) {
        await tokenStore.save(tokens);
        setUser(u);
        setStatus(needsConsent ? 'needsConsent' : 'ready');
      },
      async consentAccepted() {
        setStatus('ready');
      },
      setUser,
      async signOut() {
        await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
        await tokenStore.clear();
        setUser(null);
        setStatus('signedOut');
      },
    }),
    [status, user],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession fuera de SessionProvider');
  return ctx;
}
