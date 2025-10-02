// frontend/src/App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route, NavLink, Link } from 'react-router-dom';
import Home from './pages/Home/Home.jsx';
import MapPage from './pages/MapPage.jsx';
import Signup from './pages/Signup.jsx';
import SignupOnly from './auth/SignupOnly.jsx';
import logo from './assets/logo.png';

import Login from './auth/Login.jsx';
// Unified register page uses the RegisterBusiness page
import { useAuth } from './auth/AuthContext.jsx';
import AdminSubmissions from './pages/Admin/Submissions.jsx';

function Header() {
  const { isAuthenticated, user, logout } = useAuth();

  return (
    <header className="w-full border-b border-[#222] relative bg-[var(--ceramic)]">
      <div className="w-full px-6 py-4 relative flex items-center">
        <div className="flex items-center gap-4">
          <img src={logo} alt="Site logo" className="h-20 w-auto" draggable="false" />
          <div className="text-5xl font-extrabold tracking-wide">Bizscribe</div>
        </div>

        <nav className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3">
          <NavLink to="/" className={({ isActive }) => `px-4 py-2 rounded-full chip ${isActive ? '' : 'opacity-85'}`}>
            Home
          </NavLink>
          <NavLink to="/map" className={({ isActive }) => `px-4 py-2 rounded-full chip ${isActive ? '' : 'opacity-85'}`}>
            Map
          </NavLink>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {isAuthenticated ? (
            <>
              <button type="button" className="px-3 py-2 rounded-full btn-ghost">
                {user.display_name || user.email}
              </button>
              {user?.role === 'ADMIN' && (
                <Link to="/admin/submissions" className="px-3 py-2 rounded-full btn-ghost">
                  Admin
                </Link>
              )}
              <Link to="/register-business" className="px-3 py-2 rounded-full btn-primary">
                Register Business
              </Link>
              <button onClick={logout} className="px-3 py-2 rounded-full btn-ghost">
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="px-3 py-2 rounded-full btn-ghost">
                Login
              </Link>
              <Link to="/register" className="px-3 py-2 rounded-full btn-primary">
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex flex-col h-screen bg-[var(--bg)] text-[var(--text)]">
        <Header />

        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Signup />} />
            <Route path="/register-only" element={<SignupOnly />} />
            <Route path="/register-business" element={<Signup />} />
            <Route path="/admin/submissions" element={<AdminSubmissions />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

