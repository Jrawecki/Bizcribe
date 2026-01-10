import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthContext.jsx';
import { fetchJson } from '../../utils/apiClient.js';
import StateMessage from '../../components/StateMessage.jsx';

const STATUS_LABELS = {
  READY: 'Ready',
  NEEDS_GEOCODE: 'Needs geocode',
  NEEDS_FIX: 'Needs fix',
  DUPLICATE_PENDING: 'Duplicate pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  MERGED: 'Merged',
};

const statusBadgeClass = (status) => {
  switch (status) {
    case 'READY':
      return 'bg-green-700';
    case 'NEEDS_GEOCODE':
      return 'bg-yellow-700';
    case 'NEEDS_FIX':
      return 'bg-orange-700';
    case 'DUPLICATE_PENDING':
      return 'bg-purple-700';
    case 'APPROVED':
      return 'bg-blue-700';
    case 'REJECTED':
      return 'bg-red-700';
    case 'MERGED':
      return 'bg-slate-700';
    default:
      return 'bg-gray-700';
  }
};

export default function AdminImports() {
  const { role, isAuthenticated } = useAuth();
  const isAdmin = role === 'ADMIN';

  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState('');

  const [expanded, setExpanded] = useState({});
  const [batchItems, setBatchItems] = useState({});
  const [selected, setSelected] = useState({});
  const [editing, setEditing] = useState({});
  const [mergeTargets, setMergeTargets] = useState({});

  const loadBatches = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchJson('/api/imports/batches');
      setBatches(data || []);
    } catch (e) {
      setError(e.message || 'Failed to load import batches');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  const loadBatchItems = useCallback(async (batchId) => {
    try {
      const data = await fetchJson(`/api/imports/batches/${batchId}`);
      setBatchItems((prev) => ({ ...prev, [batchId]: data.items || [] }));
    } catch (e) {
      setError(e.message || 'Failed to load batch items');
    }
  }, []);

  const toggleBatch = async (batchId) => {
    const isOpen = !!expanded[batchId];
    setExpanded((prev) => ({ ...prev, [batchId]: !isOpen }));
    if (!isOpen && !batchItems[batchId]) {
      await loadBatchItems(batchId);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Choose a CSV file first.');
      return;
    }
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Only CSV files are supported.');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      await fetchJson('/api/imports/batches', {
        method: 'POST',
        body: formData,
      });
      setFile(null);
      await loadBatches();
    } catch (e) {
      setError(e.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const approveAllReady = async (batchId) => {
    setError('');
    try {
      await fetchJson(`/api/imports/batches/${batchId}/approve_all`, { method: 'POST' });
      await loadBatches();
      await loadBatchItems(batchId);
    } catch (e) {
      setError(e.message || 'Approve all failed');
    }
  };

  const approveSelected = async (batchId, itemIds) => {
    const ids = itemIds || selected[batchId] || [];
    if (!ids.length) return;
    setError('');
    try {
      await fetchJson(`/api/imports/batches/${batchId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_ids: ids }),
      });
      setSelected((prev) => ({ ...prev, [batchId]: [] }));
      await loadBatches();
      await loadBatchItems(batchId);
    } catch (e) {
      setError(e.message || 'Approve selected failed');
    }
  };

  const rejectSelected = async (batchId, itemIds) => {
    const ids = itemIds || selected[batchId] || [];
    if (!ids.length) return;
    setError('');
    try {
      await fetchJson(`/api/imports/batches/${batchId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_ids: ids }),
      });
      setSelected((prev) => ({ ...prev, [batchId]: [] }));
      await loadBatches();
      await loadBatchItems(batchId);
    } catch (e) {
      setError(e.message || 'Reject selected failed');
    }
  };

  const toggleSelectAll = (batchId) => {
    const items = batchItems[batchId] || [];
    if (!items.length) return;
    const current = new Set(selected[batchId] || []);
    const allIds = items.map((item) => item.id);
    const allSelected = allIds.every((id) => current.has(id));
    const next = allSelected ? [] : allIds;
    setSelected((prev) => ({ ...prev, [batchId]: next }));
  };

  const updateSelection = (batchId, itemId, checked) => {
    setSelected((prev) => {
      const current = new Set(prev[batchId] || []);
      if (checked) current.add(itemId);
      else current.delete(itemId);
      return { ...prev, [batchId]: Array.from(current) };
    });
  };

  const handleRegeocode = async (itemId, batchId) => {
    setError('');
    try {
      await fetchJson(`/api/imports/items/${itemId}/regeocode`, { method: 'POST' });
      await loadBatchItems(batchId);
      await loadBatches();
    } catch (e) {
      setError(e.message || 'Re-geocode failed');
    }
  };

  const handleReject = async (itemId, batchId) => {
    setError('');
    try {
      await fetchJson(`/api/imports/items/${itemId}/reject`, { method: 'POST' });
      await loadBatchItems(batchId);
      await loadBatches();
    } catch (e) {
      setError(e.message || 'Reject failed');
    }
  };

  const startEdit = (item) => {
    setEditing((prev) => ({
      ...prev,
      [item.id]: {
        name: item.name || '',
        description: item.description || '',
        phone_number: item.phone_number || '',
        location: item.location || '',
        lat: item.lat ?? '',
        lng: item.lng ?? '',
        address1: item.address1 || '',
        city: item.city || '',
        state: item.state || '',
        zip: item.zip || '',
      },
    }));
  };

  const cancelEdit = (itemId) => {
    setEditing((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  };

  const saveEdit = async (itemId, batchId) => {
    const payload = editing[itemId];
    if (!payload) return;
    setError('');
    try {
      await fetchJson(`/api/imports/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      cancelEdit(itemId);
      await loadBatchItems(batchId);
      await loadBatches();
    } catch (e) {
      setError(e.message || 'Update failed');
    }
  };

  const handleMerge = async (itemId, batchId) => {
    const target = mergeTargets[itemId];
    if (!target) {
      setError('Enter a target business id to merge.');
      return;
    }
    setError('');
    try {
      await fetchJson(`/api/imports/items/${itemId}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_business_id: Number(target) }),
      });
      setMergeTargets((prev) => ({ ...prev, [itemId]: '' }));
      await loadBatchItems(batchId);
      await loadBatches();
    } catch (e) {
      setError(e.message || 'Merge failed');
    }
  };

  const hasSelected = useMemo(
    () => Object.values(selected).some((list) => list && list.length > 0),
    [selected],
  );

  if (!isAuthenticated) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-2">Imports</h2>
        <p>Please log in as an administrator.</p>
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-2">Imports</h2>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">CSV Imports</h2>
        <button className="px-3 py-2 rounded-full btn-ghost" onClick={loadBatches} disabled={loading}>
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-3">
          <StateMessage variant="error">{error}</StateMessage>
        </div>
      )}

      <form onSubmit={handleUpload} className="panel rounded-xl p-4 space-y-4">
        <div>
          <label className="text-sm block mb-1">CSV file</label>
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-white/20 bg-white/5 px-3 py-2">
            <input
              type="file"
              accept=".csv"
              className="hidden"
              id="import-csv"
              onChange={(e) => {
                const next = e.target.files?.[0] || null;
                setFile(next);
                setFileName(next?.name || '');
                if (next && !next.name.toLowerCase().endsWith('.csv')) {
                  setError('Only CSV files are supported.');
                }
              }}
            />
            <label
              htmlFor="import-csv"
              className="px-3 py-2 rounded-lg btn-ghost cursor-pointer"
            >
              Choose file
            </label>
            <span className="text-xs opacity-80 truncate">
              {fileName || 'No file selected'}
            </span>
          </div>
          <p className="text-[11px] opacity-70 mt-1">Required columns only; CSV format.</p>
        </div>
        <button type="submit" className="px-4 py-2 rounded-lg btn-primary" disabled={uploading}>
          {uploading ? 'Uploading...' : 'Upload CSV'}
        </button>
      </form>

      <div className="space-y-4">
        {loading ? (
          <StateMessage variant="loading">Loading...</StateMessage>
        ) : batches.length === 0 ? (
          <StateMessage>No import batches yet.</StateMessage>
        ) : (
          batches.map((summary) => {
            const batch = summary.batch;
            const items = batchItems[batch.id] || [];
            const selectedIds = selected[batch.id] || [];
            return (
              <div key={batch.id} className="panel rounded-xl p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-lg">Batch #{batch.id}</div>
                    <div className="text-xs opacity-70">
                      {batch.source_name || 'Untitled source'} | {batch.total_rows} rows
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="px-3 py-1 rounded-full btn-ghost"
                      onClick={() => toggleBatch(batch.id)}
                    >
                      {expanded[batch.id] ? 'Hide' : 'View'}
                    </button>
                    <button
                      type="button"
                      className="px-3 py-1 rounded-full btn-primary"
                      onClick={() => approveAllReady(batch.id)}
                    >
                      Approve all ready
                    </button>
                  </div>
                </div>

                <div className="mt-3 text-xs opacity-70 flex flex-wrap gap-3">
                  <span>Ready: {summary.ready}</span>
                  <span>Needs geocode: {summary.needs_geocode}</span>
                  <span>Needs fix: {summary.needs_fix}</span>
                  <span>Duplicate: {summary.duplicate_pending}</span>
                  <span>Approved: {summary.approved}</span>
                  <span>Rejected: {summary.rejected}</span>
                  <span>Merged: {summary.merged}</span>
                </div>

                {expanded[batch.id] && (
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        className="px-3 py-1 rounded-full btn-primary"
                        onClick={() => approveSelected(batch.id)}
                        disabled={!selectedIds.length}
                      >
                        Approve selected ({selectedIds.length})
                      </button>
                      <button
                        type="button"
                        className="px-3 py-1 rounded-full btn-ghost"
                        onClick={() => rejectSelected(batch.id)}
                        disabled={!selectedIds.length}
                      >
                        Reject selected
                      </button>
                      {hasSelected && (
                        <div className="text-xs opacity-70">Tip: only ready rows will auto approve.</div>
                      )}
                    </div>

                    <div className="overflow-auto border border-[#2a2d30] rounded-lg">
                      <table className="min-w-full text-xs">
                        <thead>
                          <tr className="bg-[#101113]">
                            <th className="p-2 text-left">
                              <input
                                type="checkbox"
                                checked={items.length > 0 && selectedIds.length === items.length}
                                onChange={() => toggleSelectAll(batch.id)}
                                aria-label="Select all"
                              />
                            </th>
                            <th className="p-2 text-left">Name</th>
                            <th className="p-2 text-left">City</th>
                            <th className="p-2 text-left">State</th>
                            <th className="p-2 text-left">Status</th>
                            <th className="p-2 text-left">Coords</th>
                            <th className="p-2 text-left">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.length === 0 ? (
                            <tr>
                              <td className="p-3" colSpan={7}>
                                <StateMessage>No items loaded.</StateMessage>
                              </td>
                            </tr>
                          ) : (
                            items.map((item) => {
                              const edit = editing[item.id];
                              return (
                                <tr key={item.id} className="border-t border-[#2a2d30] align-top">
                                  <td className="p-2">
                                    <input
                                      type="checkbox"
                                      checked={selectedIds.includes(item.id)}
                                      onChange={(e) => updateSelection(batch.id, item.id, e.target.checked)}
                                    />
                                  </td>
                                  <td className="p-2">
                                    <div className="font-medium">{item.name}</div>
                                    <div className="text-[11px] opacity-70">{item.address1 || ''}</div>
                                    {item.error_message && (
                                      <div className="text-[11px] text-red-300">{item.error_message}</div>
                                    )}
                                    {edit && (
                                      <div className="mt-2 grid gap-2">
                                        <input
                                          className="w-full p-2 rounded-lg"
                                          value={edit.name}
                                          onChange={(e) =>
                                            setEditing((prev) => ({
                                              ...prev,
                                              [item.id]: { ...prev[item.id], name: e.target.value },
                                            }))
                                          }
                                        />
                                        <input
                                          className="w-full p-2 rounded-lg"
                                          value={edit.description}
                                          onChange={(e) =>
                                            setEditing((prev) => ({
                                              ...prev,
                                              [item.id]: { ...prev[item.id], description: e.target.value },
                                            }))
                                          }
                                          placeholder="Description"
                                        />
                                        <input
                                          className="w-full p-2 rounded-lg"
                                          value={edit.phone_number}
                                          onChange={(e) =>
                                            setEditing((prev) => ({
                                              ...prev,
                                              [item.id]: { ...prev[item.id], phone_number: e.target.value },
                                            }))
                                          }
                                          placeholder="Phone"
                                        />
                                        <input
                                          className="w-full p-2 rounded-lg"
                                          value={edit.address1}
                                          onChange={(e) =>
                                            setEditing((prev) => ({
                                              ...prev,
                                              [item.id]: { ...prev[item.id], address1: e.target.value },
                                            }))
                                          }
                                          placeholder="Address1"
                                        />
                                        <div className="grid grid-cols-3 gap-2">
                                          <input
                                            className="w-full p-2 rounded-lg"
                                            value={edit.city}
                                            onChange={(e) =>
                                              setEditing((prev) => ({
                                                ...prev,
                                                [item.id]: { ...prev[item.id], city: e.target.value },
                                              }))
                                            }
                                            placeholder="City"
                                          />
                                          <input
                                            className="w-full p-2 rounded-lg"
                                            value={edit.state}
                                            onChange={(e) =>
                                              setEditing((prev) => ({
                                                ...prev,
                                                [item.id]: { ...prev[item.id], state: e.target.value },
                                              }))
                                            }
                                            placeholder="State"
                                          />
                                          <input
                                            className="w-full p-2 rounded-lg"
                                            value={edit.zip}
                                            onChange={(e) =>
                                              setEditing((prev) => ({
                                                ...prev,
                                                [item.id]: { ...prev[item.id], zip: e.target.value },
                                              }))
                                            }
                                            placeholder="Zip"
                                          />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                          <input
                                            className="w-full p-2 rounded-lg"
                                            value={edit.lat}
                                            onChange={(e) =>
                                              setEditing((prev) => ({
                                                ...prev,
                                                [item.id]: { ...prev[item.id], lat: e.target.value },
                                              }))
                                            }
                                            placeholder="Lat"
                                          />
                                          <input
                                            className="w-full p-2 rounded-lg"
                                            value={edit.lng}
                                            onChange={(e) =>
                                              setEditing((prev) => ({
                                                ...prev,
                                                [item.id]: { ...prev[item.id], lng: e.target.value },
                                              }))
                                            }
                                            placeholder="Lng"
                                          />
                                        </div>
                                      </div>
                                    )}
                                  </td>
                                  <td className="p-2">{item.city || '-'}</td>
                                  <td className="p-2">{item.state || '-'}</td>
                                  <td className="p-2">
                                    <span className={`px-2 py-1 rounded-full ${statusBadgeClass(item.status)}`}>
                                      {STATUS_LABELS[item.status] || item.status}
                                    </span>
                                  </td>
                                  <td className="p-2">
                                    {item.lat != null && item.lng != null ? (
                                      <span>{item.lat.toFixed(4)}, {item.lng.toFixed(4)}</span>
                                    ) : (
                                      <span>-</span>
                                    )}
                                  </td>
                                  <td className="p-2 space-y-2">
                                    <div className="flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        className="px-2 py-1 rounded-full btn-ghost"
                                        onClick={() => approveSelected(batch.id, [item.id])}
                                      >
                                        Approve
                                      </button>
                                      <button
                                        type="button"
                                        className="px-2 py-1 rounded-full btn-ghost"
                                        onClick={() => handleReject(item.id, batch.id)}
                                      >
                                        Reject
                                      </button>
                                      <button
                                        type="button"
                                        className="px-2 py-1 rounded-full btn-ghost"
                                        onClick={() => handleRegeocode(item.id, batch.id)}
                                      >
                                        Re-geocode
                                      </button>
                                      {!editing[item.id] ? (
                                        <button
                                          type="button"
                                          className="px-2 py-1 rounded-full btn-ghost"
                                          onClick={() => startEdit(item)}
                                        >
                                          Edit
                                        </button>
                                      ) : (
                                        <>
                                          <button
                                            type="button"
                                            className="px-2 py-1 rounded-full btn-primary"
                                            onClick={() => saveEdit(item.id, batch.id)}
                                          >
                                            Save
                                          </button>
                                          <button
                                            type="button"
                                            className="px-2 py-1 rounded-full btn-ghost"
                                            onClick={() => cancelEdit(item.id)}
                                          >
                                            Cancel
                                          </button>
                                        </>
                                      )}
                                    </div>
                                    {item.status === 'DUPLICATE_PENDING' && (
                                      <div className="flex items-center gap-2">
                                        <input
                                          className="w-28 p-1 rounded-lg"
                                          value={mergeTargets[item.id] || ''}
                                          onChange={(e) =>
                                            setMergeTargets((prev) => ({ ...prev, [item.id]: e.target.value }))
                                          }
                                          placeholder="Business id"
                                        />
                                        <button
                                          type="button"
                                          className="px-2 py-1 rounded-full btn-ghost"
                                          onClick={() => handleMerge(item.id, batch.id)}
                                        >
                                          Merge
                                        </button>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
