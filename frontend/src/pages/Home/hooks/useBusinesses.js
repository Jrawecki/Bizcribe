import { useEffect, useState, useCallback } from 'react';
import { fetchJson } from '../../../utils/apiClient.js';

const toIdSet = (items = []) => new Set(items.map((item) => item.id));

export function useBusinesses({ includeMine = false } = {}) {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [manageableIds, setManageableIds] = useState(() => new Set());

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchJson('/api/businesses');
      setBusinesses(data);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }

    if (includeMine) {
      try {
        const mine = await fetchJson('/api/businesses/mine');
        setManageableIds(toIdSet(mine));
      } catch {
        setManageableIds(new Set());
      }
    } else {
      setManageableIds(new Set());
    }
  }, [includeMine]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const remove = useCallback(
    async (id) => {
      await fetchJson(`/api/businesses/${id}`, { method: 'DELETE' });
      setBusinesses((b) => b.filter((x) => x.id !== id));
      setManageableIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    },
    []
  );

  return { businesses, loading, error, refresh, remove, manageableIds };
}
