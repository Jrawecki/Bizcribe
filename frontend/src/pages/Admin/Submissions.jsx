import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext.jsx';
import { fetchJson } from '../../utils/apiClient.js';

const STATUS_OPTIONS = ['PENDING', 'APPROVED', 'REJECTED'];

function StatusBadge({ status }) {
  const color = status === 'APPROVED' ? 'bg-green-700' : status === 'REJECTED' ? 'bg-red-700' : 'bg-yellow-700';
  return (
    <span className={`px-2 py-1 rounded-full text-xs ${color}`}>
      {status}
    </span>
  );
}

export default function AdminSubmissions() {
  const { user, role, isAuthenticated } = useAuth();
  const isAdmin = role === 'ADMIN';

  const [status, setStatus] = useState('PENDING');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [selected, setSelected] = useState(null); // detailed submission
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionNotes, setActionNotes] = useState('');

  const skip = useMemo(() => page * limit, [page, limit]);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (query) params.set('query', query);
      params.set('skip', String(skip));
      params.set('limit', String(limit));
      const data = await fetchJson(`/api/businesses/submissions/search?${params.toString()}`);
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (e) {
      setError(e.message || 'Failed to load submissions');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, status, query, skip, limit]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = useCallback(async (id) => {
    setDetailLoading(true);
    setSelected(null);
    setActionNotes('');
    try {
      const sub = await fetchJson(`/api/businesses/submissions/${id}`);
      setSelected(sub);
    } catch (e) {
      setError(e.message || 'Failed to load detail');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const approve = useCallback(async () => {
    if (!selected) return;
    try {
      await fetchJson(`/api/businesses/submissions/${selected.id}/approve`, { method: 'POST' });
      setSelected(null);
      load();
    } catch (e) {
      setError(e.message || 'Approve failed');
    }
  }, [selected, load]);

  const reject = useCallback(async () => {
    if (!selected) return;
    try {
      await fetchJson(`/api/businesses/submissions/${selected.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: actionNotes || null }),
      });
      setSelected(null);
      load();
    } catch (e) {
      setError(e.message || 'Reject failed');
    }
  }, [selected, actionNotes, load]);

  if (!isAuthenticated) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-2">Admin Submissions</h2>
        <p>Please log in as an administrator.</p>
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-2">Admin Submissions</h2>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }

  const pages = Math.ceil(total / limit) || 1;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Business Submissions</h2>
        <div className="text-sm opacity-80">Total: {total}</div>
      </div>

      <div className="flex gap-3 mb-4 items-end">
        <div className="flex flex-col">
          <label className="text-sm mb-1">Status</label>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex flex-col flex-1">
          <label className="text-sm mb-1">Search</label>
          <input
            placeholder="Name, city, state, description"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(0); }}
            onKeyDown={(e) => { if (e.key === 'Enter') load(); }}
          />
        </div>
        <button className="px-3 py-2 rounded-full btn-primary" onClick={load} disabled={loading}>Search</button>
      </div>

      {error && (
        <div className="mb-3 text-red-400">{error}</div>
      )}

      <div className="overflow-auto border border-[#2a2d30] rounded-lg">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-[#101113]">
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">City</th>
              <th className="text-left p-3">State</th>
              <th className="text-left p-3">Owner</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Created</th>
              <th className="text-left p-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="p-4" colSpan={7}>Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td className="p-4" colSpan={7}>No submissions found.</td></tr>
            ) : (
              items.map((s) => (
                <tr key={s.id} className="border-t border-[#2a2d30]">
                  <td className="p-3">{s.name}</td>
                  <td className="p-3">{s.city || '-'}</td>
                  <td className="p-3">{s.state || '-'}</td>
                  <td className="p-3">{s.owner_id}</td>
                  <td className="p-3"><StatusBadge status={s.status} /></td>
                  <td className="p-3">{s.created_at ? new Date(s.created_at).toLocaleString() : '-'}</td>
                  <td className="p-3 text-right">
                    <button className="px-3 py-1 btn-ghost rounded-full" onClick={() => openDetail(s.id)}>View</button>
                  </td>
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

      {selected && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4">
          <div className="panel rounded-xl p-4 w-full max-w-2xl modal-viewport">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xl font-bold">Review Submission</h3>
              <button className="btn-ghost rounded-full px-3 py-1" onClick={() => setSelected(null)}>Close</button>
            </div>
            {detailLoading ? (
              <div className="p-4">Loading…</div>
            ) : (
              <div className="modal-scroll pr-1">
                <div className="mb-3 text-sm opacity-80">ID #{selected.id} · Owner: {selected.owner?.email || selected.owner_id}</div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div><label className="text-xs opacity-75">Name</label><div>{selected.name}</div></div>
                  <div><label className="text-xs opacity-75">Phone</label><div>{selected.phone_number || '-'}</div></div>
                  <div><label className="text-xs opacity-75">Address</label><div>{selected.address1 || '-'}</div></div>
                  <div><label className="text-xs opacity-75">Location</label><div>{selected.city || '-'}, {selected.state || '-'}</div></div>
                  <div className="col-span-2"><label className="text-xs opacity-75">Description</label><div>{selected.description || '-'}</div></div>
                </div>

                <div className="mb-3">
                  <label className="text-sm mb-1 block">Notes (for rejection)</label>
                  <textarea rows={3} value={actionNotes} onChange={(e) => setActionNotes(e.target.value)} />
                </div>

                <div className="flex items-center gap-3">
                  <button className="px-4 py-2 btn-primary rounded-full" onClick={approve}>Approve</button>
                  <button className="px-4 py-2 btn-ghost rounded-full" onClick={reject}>Reject</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

