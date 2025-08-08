import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home.jsx';
import MapPage from './pages/MapPage.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex flex-col h-screen">
        <header className="flex items-center justify-between p-6 bg-indigo-600 dark:bg-gray-800 text-white shadow-lg">
          <nav className="flex space-x-4">
            <Link to="/" className="px-4 py-2 bg-white dark:bg-gray-700 rounded-full">Home</Link>
            <Link to="/map" className="px-4 py-2 bg-white dark:bg-gray-700 rounded-full">Map</Link>
          </nav>
        </header>
        <main className="flex-1 overflow-hidden">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/map" element={<MapPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
