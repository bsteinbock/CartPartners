import type { Player } from '@/lib/players';
import { getPlayers } from '@/lib/players';
import { useCallback, useEffect, useState } from 'react';

export default function useAvailablePlayers() {
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await getPlayers();
      const filtered = (rows || []).filter((p) => !!p.available);
      setAvailablePlayers(filtered);
    } catch (e) {
      console.warn('useAvailablePlayers: failed to load players', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { availablePlayers, refresh: load, loading } as const;
}
