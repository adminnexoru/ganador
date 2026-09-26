import { useCallback, useEffect, useRef, useState } from 'react';

import { errorMessage } from '@/api/client';

/** Carga de datos simple con recarga manual y opcional periódica. */
export function useQuery<T>(load: () => Promise<T>, deps: unknown[], opts: { refreshMs?: number } = {}) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  const reload = useCallback(async () => {
    try {
      setData(await loadRef.current());
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    if (!opts.refreshMs) return;
    const id = setInterval(() => void reload(), opts.refreshMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading, reload, setData };
}
