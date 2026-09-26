import * as SecureStore from 'expo-secure-store';

import i18n from '@/i18n';

import { API_URL } from './config';
import type { Tokens } from './types';

const REFRESH_KEY = 'ganador.refreshToken';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let accessToken: string | null = null;
let onSignedOut: (() => void) | null = null;
let refreshing: Promise<boolean> | null = null;

/** Tokens: el de renovación en expo-secure-store; el de acceso solo en memoria. */
export const tokenStore = {
  async save(tokens: Tokens) {
    accessToken = tokens.accessToken;
    await SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken);
  },
  async clear() {
    accessToken = null;
    await SecureStore.deleteItemAsync(REFRESH_KEY);
  },
  hasRefreshToken: async () => Boolean(await SecureStore.getItemAsync(REFRESH_KEY)),
  onSignedOut(cb: () => void) {
    onSignedOut = cb;
  },
};

async function refresh(): Promise<boolean> {
  const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
  if (!refreshToken) return false;
  const res = await fetch(`${API_URL}/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) return false;
  await tokenStore.save((await res.json()) as Tokens);
  return true;
}

type Options = { method?: string; body?: unknown; auth?: boolean; form?: FormData };

/** Cliente tipado de contracts/app-api.md con renovación automática ante 401. */
export async function api<T>(path: string, opts: Options = {}, retried = false): Promise<T> {
  const { method = 'GET', body, auth = true, form } = opts;
  if (auth && !accessToken && !retried) {
    refreshing ??= refresh().finally(() => (refreshing = null));
    await refreshing;
  }
  const headers: Record<string, string> = { 'Accept-Language': i18n.language || 'es-MX' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(`${API_URL}/v1${path}`, {
    method,
    headers,
    body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });

  if (res.status === 401 && auth && !retried) {
    accessToken = null;
    refreshing ??= refresh().finally(() => (refreshing = null));
    if (await refreshing) return api<T>(path, opts, true);
    await tokenStore.clear();
    onSignedOut?.();
  }
  if (!res.ok) {
    const json = (await res.json().catch(() => null)) as { error?: { code: string; message: string } } | null;
    throw new ApiError(res.status, json?.error?.code ?? 'internal_error', json?.error?.message ?? i18n.t('common.error'));
  }
  if (res.status === 204 || res.status === 202) return undefined as T;
  return (await res.json()) as T;
}

export const errorMessage = (e: unknown) => (e instanceof ApiError ? e.message : i18n.t('common.error'));
