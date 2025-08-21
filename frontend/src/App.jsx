import React from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Home from './pages/Home/Home.jsx';     // ⟵ updated path
import MapPage from './pages/MapPage.jsx';
import logo from './assets/logo.png';

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex flex-col h-screen bg-[var(--ceramic)] text-[var(--text)]">
        <header className="w-full border-b border-[#222] relative">
          <div className="w-full px-6 py-4 relative flex items-center">
            <div className="flex items-center gap-4">
              <img src={logo} alt="Site logo" className="h-20 w-auto" draggable="false" />
              <div className="text-5xl font-extrabold tracking-wide">Bizscribe</div>
            </div>
            <nav className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3">
              <NavLink to="/" className={({ isActive }) => `px-4 py-2 rounded-full chip ${isActive ? '' : 'opacity-85'}`}>Home</NavLink>
              <NavLink to="/map" className={({ isActive }) => `px-4 py-2 rounded-full chip ${isActive ? '' : 'opacity-85'}`}>Map</NavLink>
            </nav>
          </div>
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
