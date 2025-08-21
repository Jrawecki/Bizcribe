export default function AddressSearch({ state, actions, onPick }) {
  const { query, setQuery, open, setOpen, fetching, list } = state;

  return (
    <div className="relative">
      <label className="block text-sm mb-1">Address search (US) — choose a suggestion or drop a pin</label>
      <input
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); actions.search(e.target.value); }}
        placeholder="e.g., 1007 N Orange St, Wilmington"
        className="w-full p-3 rounded-lg"
      />
      {open && list.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full max-h-60 overflow-auto rounded-lg border border-[#2a2d30] bg-[#0f1012] shadow">
          {list.map((s, idx) => (
            <li key={`${s.label}-${idx}`}
                onClick={() => { actions.lock(); onPick(s); }}
                className="px-3 py-2 cursor-pointer hover:bg-[#131417]">
              {s.label}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-1 text-sm min-h-[20px]">{fetching ? 'Searching…' : ''}</div>
    </div>
  );
}
