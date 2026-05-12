import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext.jsx';
import { fetchJson } from '../../utils/apiClient.js';
import StateMessage from '../../components/StateMessage.jsx';
import AdminTabs from './AdminTabs.jsx';

export default function AdminCustomers() {
  const { role, isAuthenticated } = useAuth();
  const isAdmin = role === 'ADMIN';

  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const limit = 20;
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const skip = page * limit;

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (query) params.set('query', query);
      params.set('skip', String(skip));
      params.set('limit', String(limit));
      const data = await fetchJson(`/api/admin/users/search?${params.toString()}`);
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (e) {
      setError(e.message || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, query, skip, limit]);

  useEffect(() => {
    load();
  }, [load]);

  if (!isAuthenticated) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-2">Customers</h2>
        <p>Please log in as an administrator.</p>
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-2">Customers</h2>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }

  const pages = Math.ceil(total / limit) || 1;

  return (
    <div className="p-6">
      <AdminTabs />
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Customers</h2>
        <div className="text-sm opacity-80">Total: {total}</div>
      </div>

      <p className="text-sm opacity-70 mb-3">
        Consumer accounts (people who signed up to browse businesses). Business owners with submissions are listed on the Submissions page.
      </p>

      <div className="flex gap-3 mb-4 items-end">
        <div className="flex flex-col flex-1">
          <label className="text-sm mb-1">Search</label>
          <input
            placeholder="Email or display name"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(0); }}
            onKeyDown={(e) => { if (e.key === 'Enter') load(); }}
          />
        </div>
        <button className="px-3 py-2 rounded-full btn-primary" onClick={load} disabled={loading}>Search</button>
      </div>

      {error && (
        <div className="mb-3">
          <StateMessage variant="error">{error}</StateMessage>
        </div>
      )}

      <div className="overflow-auto border border-[var(--border)] rounded-lg">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-[var(--bg-alt)]">
              <th className="text-left p-3">Display name</th>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3">Role</th>
              <th className="text-left p-3">Created</th>
              <th className="text-left p-3">ID</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="p-4" colSpan={5}><StateMessage variant="loading">Loading...</StateMessage></td></tr>
            ) : items.length === 0 ? (
              <tr><td className="p-4" colSpan={5}><StateMessage>No customers found.</StateMessage></td></tr>
            ) : (
              items.map((u) => (
                <tr key={u.id} className="border-t border-[var(--border)]">
                  <td className="p-3">{u.display_name || '-'}</td>
                  <td className="p-3">{u.email}</td>
                  <td className="p-3">{u.role}</td>
                  <td className="p-3">{u.created_at ? new Date(u.created_at).toLocaleString() : '-'}</td>
                  <td className="p-3 opacity-70">#{u.id}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3 mt-4">
        <button
          className="px-3 py-2 btn-ghost rounded-full"
          disabled={page <= 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
        >Prev</button>
        <div>Page {page + 1} / {pages}</div>
        <button
          className="px-3 py-2 btn-ghost rounded-full"
          disabled={(page + 1) >= pages}
          onClick={() => setPage((p) => p + 1)}
        >Next</button>
      </div>
    </div>
  );
}
