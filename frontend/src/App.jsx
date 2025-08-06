import React, { useState, useEffect } from 'react';
import {
  PlusCircle,
  Search,
  Phone,
  MapPin,
  Trash2,
  Sun,
  Moon,
} from 'lucide-react';
import './index.css'; // Ensure Tailwind is loaded

export default function App() {
  const [businesses, setBusinesses] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    phone_number: '',
    location: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Initialize dark mode from localStorage or OS preference
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const stored = localStorage.getItem('theme');
    if (stored) return stored === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Toggle dark class on <html> and persist
  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // Fetch businesses
  const fetchBusinesses = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/businesses');
      if (!res.ok) throw new Error('Failed to fetch businesses');
      const data = await res.json();
      setBusinesses(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBusinesses();
  }, []);

  const filtered = businesses.filter(
    (biz) =>
      biz.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      biz.location?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error('Failed to add business');
      setFormData({ name: '', description: '', phone_number: '', location: '' });
      setShowModal(false);
      fetchBusinesses();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteBusiness = async (id) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/businesses/${id}`, { method: 'DELETE' });
      if (res.status !== 204) throw new Error('Failed to delete business');
      fetchBusinesses();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-white dark:bg-gray-900 transition-colors duration-500">
      {/* Header */}
      <header className="flex items-center justify-between p-6 bg-indigo-600 dark:bg-gray-800 text-white shadow-lg">
        <h1 className="text-3xl font-extrabold tracking-widest">PlaceHolder</h1>
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 bg-indigo-500 dark:bg-gray-700 rounded-full hover:bg-indigo-400 dark:hover:bg-gray-600 transition"
          >
            {isDarkMode ? <Sun className="text-yellow-300" /> : <Moon className="text-gray-200" />}
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 px-4 py-2 rounded-full shadow hover:shadow-md transition"
          >
            <PlusCircle className="mr-2" /> Add Business
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto py-8 px-6">
        {/* Search Bar */}
        <div className="max-w-6xl mx-auto mb-6 flex items-center">
          <div className="relative w-full max-w-xl">
            <Search className="absolute left-4 top-3 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Search businesses or locations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
        </div>

        {error && <p className="text-red-500 text-center mb-4">Error: {error}</p>}

        {/* Cards Grid */}
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filtered.map((biz) => (
            <div
              key={biz.id}
              className="bg-gray-100 dark:bg-gray-800 p-6 rounded-2xl shadow-lg hover:shadow-2xl transform hover:-translate-y-1 transition-colors duration-300"
            >
              <h2 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mb-2">{biz.name}</h2>
              <p className="mb-4 text-gray-800 dark:text-gray-300">{biz.description || 'No description provided.'}</p>
              <div className="flex items-center text-gray-600 dark:text-gray-400 text-sm mb-2">
                <Phone className="mr-2" size={16} /> {biz.phone_number || 'N/A'}
              </div>
              <div className="flex items-center text-gray-600 dark:text-gray-400 text-sm">
                <MapPin className="mr-2" size={16} /> {biz.location || 'N/A'}
              </div>
              <button
                onClick={() => deleteBusiness(biz.id)}
                className="mt-4 self-end text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-600 transition"
              >
                <Trash2 />
              </button>
            </div>
          ))}
        </div>

        {!loading && filtered.length === 0 && (
          <p className="text-gray-500 dark:text-gray-400 text-center mt-12">
            No businesses match your search. Try adding one!
          </p>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gray-200 dark:bg-gray-800 py-4 shadow-inner">
        <div className="max-w-6xl mx-auto text-center text-gray-700 dark:text-gray-400 text-sm">
          © {new Date().getFullYear()} PlaceHolder. All rights reserved.
        </div>
      </footer>

      {/* Add Business Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Add a New Business</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 transition">
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                <input
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              {/* ...other form fields... */}
              <div className="flex justify-end space-x-3 mt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-600 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
