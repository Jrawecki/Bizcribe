// frontend/src/pages/RegisterBusiness.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { fetchJson } from '../utils/apiClient.js';
import AddressSearch from './Home/AddressSearch.jsx';
import MiniMap from './Home/MiniMap.jsx';
import { useAddressSearch } from './Home/hooks/useAddressSearch.js';
import vetSchema from '../data/businessVetForm.json';

const emptyForm = {
  name: '',
  description: '',
  phone_number: '',
  address1: '',
  city: '',
  state: '',
  zip: '',
  location: '',
  hide_address: false,
  lat: null,
  lng: null,
};

const ADDRESS_KEYS = ['address1', 'city', 'state', 'zip'];
const manualLocation = (data) => ADDRESS_KEYS.map((key) => data[key]).filter(Boolean).join(', ');

export default function Signup() {
  const { isAuthenticated, register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [addressMode, setAddressMode] = useState('search');
  const [account, setAccount] = useState({ email: '', password: '', display_name: '' });
  const [vetAnswers, setVetAnswers] = useState({});
  const [vetOther, setVetOther] = useState({});
  const [vetSearch, setVetSearch] = useState({});
  const [vetOpen, setVetOpen] = useState({});
  const [vetGroupOpen, setVetGroupOpen] = useState({});
  const industriesMenuRef = useRef(null);
  const isDirty = useMemo(() => {
    const hasForm = Object.values({ ...form, ...account }).some((v) => (v ?? '').toString().trim());
    const hasVet = Object.keys(vetAnswers).length > 0 || Object.keys(vetOther).length > 0;
    return hasForm || hasVet;
  }, [form, account, vetAnswers, vetOther]);

  const addr = useAddressSearch();
  const vetAddr = useAddressSearch();

  useEffect(() => {
    const onDown = (e) => {
      const menu = industriesMenuRef.current;
      if (menu && !menu.contains(e.target)) {
        setVetOpen((prev) => ({ ...prev, industries: false }));
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // Unified page: if not authenticated, show account creation section at top

  const setField = (key, value) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (addressMode === 'manual' && ADDRESS_KEYS.includes(key)) {
        next.location = manualLocation(next);
      }
      return next;
    });
  };

  const switchToManual = () => {
    setAddressMode('manual');
    addr.actions.unlock();
    setForm((prev) => ({ ...prev, location: manualLocation(prev) }));
  };

  const switchToSearch = () => {
    setAddressMode('search');
    addr.actions.unlock();
  };

  const basicsIncomplete =
    (!isAuthenticated && (!account.email.trim() || !account.password.trim())) ||
    !form.name.trim() ||
    form.lat == null ||
    form.lng == null ||
    !(form.location && form.location.trim());

  const vetRequiredMissing = useMemo(() => {
    const sections = vetSchema.sections || [];
    return sections.some((section) =>
      (section.fields || []).some((field) => {
        if (!field.required) return false;
        if (field.type === 'multiselect') {
          const selected = Array.isArray(vetAnswers[field.id]) ? vetAnswers[field.id] : [];
          const other = vetOther[field.id]?.trim();
          return selected.length + (other ? 1 : 0) === 0;
        }
        const value = vetAnswers[field.id];
        if (value == null) return true;
        const str = String(value).trim();
        return !str;
      })
    );
  }, [vetAnswers, vetOther]);

  const disableSubmit = submitting || basicsIncomplete || (step === 2 && vetRequiredMissing);

  async function handleSubmit(e) {
    e.preventDefault();
    if (step === 1) {
      if (disableSubmit) return;
      setStep(2);
      return;
    }

    if (disableSubmit) return;

    setSubmitting(true);
    setError('');

    try {
      const bizPayload = {
        name: form.name,
        description: form.description || null,
        phone_number: form.phone_number || null,
        location: form.location || manualLocation(form),
        hide_address: !!form.hide_address,
        lat: form.lat,
        lng: form.lng,
        address1: form.address1 || null,
        city: form.city || null,
        state: form.state || null,
        zip: form.zip || null,
      };

      const buildVettingPayload = () => {
        const sections = vetSchema.sections || [];
        const answers = {};
        sections.forEach((section) => {
          (section.fields || []).forEach((field) => {
            if (field.type === 'multiselect') {
              const selected = Array.isArray(vetAnswers[field.id]) ? vetAnswers[field.id] : [];
              const other = vetOther[field.id]?.trim();
              answers[field.id] = other ? [...selected, other] : selected;
            } else {
              answers[field.id] = vetAnswers[field.id] ?? '';
            }
          });
        });
        return {
          version: vetSchema.formVersion || 1,
          answers,
        };
      };

      const vettingPayload = buildVettingPayload();

      if (!isAuthenticated) {
        await register({
          email: account.email,
          password: account.password,
          display_name: account.display_name,
          business: { ...bizPayload, vetting: vettingPayload },
        });
      } else {
        await fetchJson('/api/businesses/submissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...bizPayload, vetting: vettingPayload }),
        });
      }

      setSubmitted(true);
      setForm(emptyForm);
      addr.actions.unlock();
      addr.state.setQuery('');
      addr.state.setOpen(false);
      setVetAnswers({});
      setVetOther({});
      setStep(1);
    } catch (e) {
      setError(e.message || 'Failed to submit business for review');
    } finally {
      setSubmitting(false);
    }
  }

  const handleVetChange = (id, value) => {
    setVetAnswers((prev) => ({ ...prev, [id]: value }));
  };

  const toggleMulti = (id, option) => {
    setVetAnswers((prev) => {
      const current = Array.isArray(prev[id]) ? prev[id] : [];
      const set = new Set(current);
      if (set.has(option)) set.delete(option);
      else set.add(option);
      return { ...prev, [id]: Array.from(set) };
    });
  };

  const renderVetField = (field) => {
    const value = vetAnswers[field.id] ?? '';
    if (field.id === 'address' || field.id === 'hide_address') return null;
    switch (field.type) {
      case 'text':
      case 'url':
        return (
          <input
            type={field.type === 'url' ? 'url' : 'text'}
            className="w-full p-3 rounded-lg bg-white/5 border border-white/10"
            placeholder={field.placeholder}
            value={value}
            onChange={(e) => handleVetChange(field.id, e.target.value)}
            required={field.required}
          />
        );
      case 'select':
        return (
          <select
            className="w-full p-3 rounded-lg bg-white/5 border border-white/10"
            value={value || ''}
            onChange={(e) => handleVetChange(field.id, e.target.value)}
            required={field.required}
          >
            <option value="">Select an option</option>
            {(field.options || []).map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );
      case 'multiselect': {
        const selected = Array.isArray(vetAnswers[field.id]) ? vetAnswers[field.id] : [];
        const otherVal = vetOther[field.id] || '';
        const allOptions = (field.groups || []).flatMap((g) => g.options || []);
        const uniqueOptions = Array.from(new Set(allOptions));
        const searchVal = vetSearch[field.id] || '';
        const filtered = (searchVal ? uniqueOptions.filter((opt) => opt.toLowerCase().includes(searchVal.toLowerCase())) : uniqueOptions);
        const isOpen = !!vetOpen[field.id] || !!searchVal;

        const addFreeform = (text) => {
          const trimmed = text.trim();
          if (!trimmed) return;
          setVetOther((prev) => ({ ...prev, [field.id]: '' }));
          setVetSearch((prev) => ({ ...prev, [field.id]: '' }));
          toggleMulti(field.id, trimmed);
          setVetOpen((prev) => ({ ...prev, [field.id]: false }));
        };

        const renderGroups = () => {
          return (field.groups || []).map((group) => {
            const groupId = `${field.id}-${group.label}`;
            const open = vetGroupOpen[groupId] ?? false;
            const groupOptions = (group.options || []).filter((opt) =>
              opt.toLowerCase().includes(searchVal.toLowerCase())
            );
            if (!groupOptions.length) return null;
            return (
              <div key={group.label} className="border-b border-white/10 last:border-0">
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-3 py-2 text-sm font-semibold text-white/80 hover:bg-white/5"
                  onClick={() => setVetGroupOpen((prev) => ({ ...prev, [groupId]: !open }))}
                >
                  {group.label}
                  <span className="text-xs text-white/60">{open ? '-' : '+'}</span>
                </button>
                {open && (
                  <div className="py-2 px-3 space-y-1">
                    {groupOptions.map((opt) => {
                      const checked = selected.includes(opt);
                      return (
                        <label key={opt} className="flex items-center gap-2 text-sm text-white/80 hover:bg-white/5 rounded-md px-2 py-1">
                          <input
                            type="checkbox"
                            className="accent-[var(--blue,#5d85ff)]"
                            checked={checked}
                            onChange={() => toggleMulti(field.id, opt)}
                          />
                          {opt}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          });
        };

        return (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {selected.map((opt) => (
                <span key={opt} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/10 text-sm">
                  {opt}
                  <button
                    type="button"
                    className="text-xs text-white/70"
                    onClick={() => toggleMulti(field.id, opt)}
                    aria-label={`Remove ${opt}`}
                  >
                    x
                  </button>
                </span>
              ))}
            </div>

            <div className="relative" ref={field.id === 'industries' ? industriesMenuRef : null}>
              <input
                className="w-full p-3 rounded-lg bg-white/5 border border-white/10"
                placeholder="Search or browse industries"
                value={searchVal}
                onChange={(e) => setVetSearch((prev) => ({ ...prev, [field.id]: e.target.value }))}
                onFocus={() => setVetOpen((prev) => ({ ...prev, [field.id]: true }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addFreeform(searchVal);
                  }
                }}
              />
              {isOpen && (
                <div className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto rounded-lg bg-[var(--bg)] border border-white/10 shadow-xl">
                  {renderGroups()}
                </div>
              )}
            </div>

            {field.allowOther && (
              <div className="space-y-1">
                <label className="text-sm text-white/80">Other</label>
                <div className="flex gap-2">
                  <input
                    className="w-full p-3 rounded-lg bg-white/5 border border-white/10"
                    placeholder="Add another industry"
                    value={otherVal}
                    onChange={(e) => setVetOther((prev) => ({ ...prev, [field.id]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addFreeform(otherVal);
                        setVetOpen((prev) => ({ ...prev, [field.id]: false }));
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-sm"
                    onClick={() => {
                      addFreeform(otherVal);
                      setVetOpen((prev) => ({ ...prev, [field.id]: false }));
                    }}
                  >
                    Add
                  </button>
                </div>
                <p className="text-xs text-white/60">Use Add to include multiple custom industries.</p>
              </div>
            )}
          </div>
        );
      }
      case 'toggle':
        return (
          <label className="inline-flex items-center gap-2 text-sm text-white/80">
            <input
              type="checkbox"
              className="accent-[var(--blue,#5d85ff)]"
              checked={!!vetAnswers[field.id]}
              onChange={(e) => handleVetChange(field.id, e.target.checked)}
            />
            {field.helper ? <span className="text-white/70">{field.helper}</span> : null}
          </label>
        );
      default:
        return null;
    }
  };

  const vetFieldsView = (
    <div className="space-y-6">
      {(vetSchema.sections || []).map((section) => (
        <div key={section.id} className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">{section.title}</h2>
            {section.helper && <p className="text-sm text-white/70 mt-1">{section.helper}</p>}
          </div>
          <div className="space-y-4">
            {(section.fields || []).map((field) => (
              <div key={field.id} className="space-y-1">
                <label className="block text-sm font-medium">
                  {field.label}
                  {field.required ? (
                    <span className="text-red-300 ml-1">*</span>
                  ) : (
                    <span className="text-white/60 ml-1 text-xs">* Not required</span>
                  )}
                </label>
                {field.helper && <p className="text-xs text-white/60">{field.helper}</p>}
                {renderVetField(field)}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  //

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[var(--bg)] text-center gap-4 p-6">
        <h1 className="text-3xl font-semibold">Thanks! Your business is awaiting approval.</h1>
        <p className="max-w-md text-sm opacity-80">
          Our team will review the submission and publish it once it is approved. You can register another business at any time.
        </p>
        <div className="flex gap-3">
          <button className="px-4 py-2 rounded-full btn-primary" onClick={() => nav('/')}>Back to Home</button>
          <button className="px-4 py-2 rounded-full btn-ghost" onClick={() => setSubmitted(false)}>Register another</button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--bg)] text-[var(--text)] min-h-screen overflow-y-auto py-10">
      <div className="max-w-6xl mx-auto px-4 pb-12">
        <h1 className="text-3xl font-semibold mb-2">Register a Business</h1>
        <p className="text-sm opacity-80 mb-6">
          Provide the business details below. We will review your submission and notify you once it is approved.
        </p>

        {error && <div className="text-red-300 mb-4">{error}</div>}

        {step === 1 ? (
          <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              {!isAuthenticated && (
                <>
                  <div>
                <label className="block text-sm mb-1">
                  Email <span className="text-red-300">*</span>
                </label>
                    <input
                      type="email"
                      className="w-full p-3 rounded-lg"
                      value={account.email}
                      onChange={(e) => setAccount((a) => ({ ...a, email: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                <label className="block text-sm mb-1">
                  Username <span className="text-red-300">*</span>
                </label>
                    <input
                      className="w-full p-3 rounded-lg"
                      value={account.display_name}
                      onChange={(e) => setAccount((a) => ({ ...a, display_name: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                <label className="block text-sm mb-1">
                  Password <span className="text-red-300">*</span>
                </label>
                    <input
                      type="password"
                      className="w-full p-3 rounded-lg"
                      value={account.password}
                      onChange={(e) => setAccount((a) => ({ ...a, password: e.target.value }))}
                      required
                    />
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm mb-1">
                  Business name <span className="text-red-300">*</span>
                </label>
                <input
                  className="w-full p-3 rounded-lg"
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-sm mb-1">
                  Description <span className="text-red-300">*</span>
                </label>
                <textarea
                  className="w-full p-3 rounded-lg h-24 resize-none"
                  value={form.description}
                  onChange={(e) => setField('description', e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-sm mb-1">
                  Phone number <span className="text-red-300">*</span>
                </label>
                <input
                  className="w-full p-3 rounded-lg"
                  value={form.phone_number}
                  onChange={(e) => setField('phone_number', e.target.value)}
                  required
                />
              </div>

                {addressMode === 'search' ? (
                  <>
                    <AddressSearch
                      state={addr.state}
                      actions={addr.actions}
                      onPick={(selection) => {
                      if (selection.lat != null && selection.lng != null) {
                        setForm((prev) => ({ ...prev, lat: selection.lat, lng: selection.lng }));
                      }
                      addr.state.setQuery(selection.label, { keepLocked: true });
                      addr.actions.lock();
                      setForm((prev) => ({
                        ...prev,
                        location: selection.label,
                        address1: selection.address?.line1 || prev.address1,
                        city: selection.address?.city || prev.city,
                        state: selection.address?.state || prev.state,
                        zip: selection.address?.zip || prev.zip,
                      }));
                    }}
                  />
                  <div className="flex items-center justify-between text-xs mt-1">
                    <p className="opacity-70">
                      Use the search box or map to find the location. We will capture the address automatically.
                    </p>
                    <button
                      type="button"
                      className="text-[var(--blue)] underline"
                      onClick={switchToManual}
                    >
                      Can't find the address?
                    </button>
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm text-white/80 mt-2">
                    <input
                      type="checkbox"
                      className="accent-[var(--blue,#5d85ff)]"
                      checked={form.hide_address}
                      onChange={(e) => setField('hide_address', e.target.checked)}
                    />
                    Hide my address from public map
                  </label>
                  </>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm mb-1">
                      Street <span className="text-white/60 text-xs ml-1">* Not required</span>
                    </label>
                    <input
                      className="w-full p-3 rounded-lg"
                      value={form.address1}
                      onChange={(e) => setField('address1', e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                    <label className="block text-sm mb-1">
                      City <span className="text-white/60 text-xs ml-1">* Not required</span>
                    </label>
                      <input
                        className="w-full p-3 rounded-lg"
                        value={form.city}
                        onChange={(e) => setField('city', e.target.value)}
                      />
                    </div>
                    <div>
                    <label className="block text-sm mb-1">
                      State <span className="text-white/60 text-xs ml-1">* Not required</span>
                    </label>
                      <input
                        className="w-full p-3 rounded-lg"
                        value={form.state}
                        onChange={(e) => setField('state', e.target.value)}
                      />
                    </div>
                    <div>
                    <label className="block text-sm mb-1">
                      ZIP <span className="text-white/60 text-xs ml-1">* Not required</span>
                    </label>
                      <input
                        className="w-full p-3 rounded-lg"
                        value={form.zip}
                        onChange={(e) => setField('zip', e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <p className="opacity-70">
                      Enter the address manually, then drop a pin on the map to confirm the location.
                    </p>
                    <button
                      type="button"
                      className="text-[var(--blue)] underline"
                      onClick={switchToSearch}
                    >
                      Use address search
                    </button>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg btn-primary disabled:opacity-50"
                  disabled={disableSubmit}
                >
                  Next
                </button>
                {!isAuthenticated && (
                  <button
                    type="button"
                    onClick={() => nav('/register-only')}
                    className="px-4 py-2 rounded-lg btn-ghost"
                  >
                    Just sign up
                  </button>
                )}
              </div>
            </div>

            <div className="lg:sticky lg:top-4 h-[72vh]">
              <MiniMap
                value={{ lat: form.lat, lng: form.lng }}
                pinEnabled={addressMode === 'manual'}
                onChange={({ lat, lng }) =>
                  setForm((prev) => ({
                    ...prev,
                    lat,
                    lng,
                    location:
                      addressMode === 'manual' && prev.location
                        ? prev.location
                        : prev.location || `Dropped pin (${lat?.toFixed?.(5)}, ${lng?.toFixed?.(5)})`,
                  }))
                }
              />
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="max-w-5xl mx-auto space-y-6">
            <div className="rounded-2xl bg-white/5 border border-white/10 p-5 flex items-center justify-between shadow-lg">
              <div>
                <p className="text-sm text-white/70">Step 2 of 2</p>
                <h2 className="text-xl font-semibold">Vetting details</h2>
                <p className="text-sm text-white/70 mt-1">
                  Tell us more about your business. This helps us review and feature you correctly.
                </p>
              </div>
              <button
                type="button"
                className="text-sm underline text-[var(--blue,#5d85ff)]"
                onClick={() => setStep(1)}
              >
                Back to basics
              </button>
            </div>

            {vetFieldsView}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                className="px-4 py-2 rounded-lg btn-ghost"
                onClick={() => setStep(1)}
              >
                Back
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg btn-primary disabled:opacity-50"
                disabled={disableSubmit}
              >
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
