import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { ApiError } from '@/api/client';
import { getLocation } from '@/api/pets';
import type { Location } from '@/api/types';

type Cached = { location: Location | null; savedAt: string };

/**
 * Ubicación con actualización cada 30 s y caché en el celular (M1): sin conexión se muestra
 * la última respuesta con su hora.
 */
export function useCachedLocation(petId: string) {
  const key = `ganador.location.${petId}`;
  const [location, setLocation] = useState<Location | null | undefined>(undefined);
  const [offlineSince, setOfflineSince] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const readCache = () =>
      AsyncStorage.getItem(key).then((raw) => (raw ? (JSON.parse(raw) as Cached) : null));

    // Muestra primero la caché para que el mapa aparezca de inmediato (SC-001).
    void readCache().then((cached) => {
      if (active && cached) setLocation((cur) => (cur === undefined ? cached.location : cur));
    });

    const tick = () =>
      getLocation(petId).then(
        (fresh) => {
          if (!active) return;
          setLocation(fresh);
          setOfflineSince(null);
          void AsyncStorage.setItem(key, JSON.stringify({ location: fresh, savedAt: new Date().toISOString() }));
        },
        (e) => {
          if (!active || e instanceof ApiError) return;
          void readCache().then((cached) => {
            if (!active) return;
            setLocation(cached?.location ?? null);
            setOfflineSince(cached?.savedAt ?? null);
          });
        },
      );

    void tick();
    const id = setInterval(() => void tick(), 30_000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [key, petId]);

  return { location, offlineSince };
}
