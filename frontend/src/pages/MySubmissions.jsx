import React, { useEffect, useState, useCallback } from 'react';
import { fetchJson } from '../utils/apiClient.js';

export default function MySubmissions() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchJson('/api/businesses/submissions/mine');
      setItems(data || []);
    } catch (e) {
      setError(e.message || 'Failed to load submissions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = async (id) => {
    try {
      await fetchJson(`/api/businesses/submissions/${id}`, { method: 'DELETE' });
      setItems((list) => list.filter((x) => x.id !== id));
    } catch (e) {
      setError(e.message || 'Failed to delete submission');
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">My Business Submissions</h1>
      {error && <div className="mb-3 text-red-400">{error}</div>}
      <div className="overflow-auto border border-[#2a2d30] rounded-lg">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-[#101113]">
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">City</th>
              <th className="text-left p-3">State</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Created</th>
              <th className="text-left p-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="p-4" colSpan={6}>Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td className="p-4" colSpan={6}>No submissions yet.</td></tr>
            ) : (
              items.map((s) => (
                <tr key={s.id} className="border-t border-[#2a2d30]">
                  <td className="p-3">{s.name}</td>
                  <td className="p-3">{s.city || '-'}</td>
                  <td className="p-3">{s.state || '-'}</td>
                  <td className="p-3">{s.status}</td>
                  <td className="p-3">{s.created_at ? new Date(s.created_at).toLocaleString() : '-'}</td>
                  <td className="p-3 text-right">
                    <button className="px-3 py-1 btn-ghost rounded-full" onClick={() => remove(s.id)}>Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

