import { useEffect, useState, useCallback } from 'react';

export function useBusinesses() {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/businesses');
      if (!res.ok) throw new Error('Failed to load businesses');
      setBusinesses(await res.json());
      setError(null);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const create = async (payload) => {
    const res = await fetch('/api/businesses', {
      method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to add business');
    await refresh();
  };

  const remove = async (id) => {
    const res = await fetch(`/api/businesses/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete business');
    setBusinesses((b) => b.filter(x => x.id !== id));
  };

  return { businesses, loading, error, refresh, create, remove };
}
