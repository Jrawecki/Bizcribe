// frontend/src/App.jsx
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BrowserRouter, Routes, Route, NavLink, Link } from 'react-router-dom';
import Home from './pages/Home/Home.jsx';
import MapPage from './pages/MapPage.jsx';
import GarageSale from './pages/GarageSale.jsx';
import BusinessDetail from './pages/BusinessDetail.jsx';
import MySubmissions from './pages/MySubmissions.jsx';
import Signup from './pages/Signup.jsx';
import SignupOnly from './auth/SignupOnly.jsx';

import Login from './auth/Login.jsx';
// Unified register page uses the RegisterBusiness page
import { useAuth } from './auth/AuthContext.jsx';
import AdminSubmissions from './pages/Admin/Submissions.jsx';
import About from './pages/About.jsx';
import Contact from './pages/Contact.jsx';

function Header() {
  const { isAuthenticated, user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const userButtonRef = useRef(null);
  const menuPanelRef = useRef(null);
  const [menuRect, setMenuRect] = useState(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (event) => {
      const menuEl = menuRef.current;
      const buttonEl = userButtonRef.current;
      const panelEl = menuPanelRef.current;
      if (
        menuEl &&
        !menuEl.contains(event.target) &&
        (!panelEl || !panelEl.contains(event.target)) &&
        (!buttonEl || !buttonEl.contains(event.target))
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen || typeof window === 'undefined') return undefined;
    const updateRect = () => {
      const buttonEl = userButtonRef.current;
      if (!buttonEl) return;
      const rect = buttonEl.getBoundingClientRect();
      const panelWidth = Math.max(rect.width, 200);
      const viewportLeft = window.scrollX + 16;
      const viewportRight = window.scrollX + window.innerWidth - 16;
      const preferredLeft = rect.left + window.scrollX;
      const clampedLeft = Math.min(
        Math.max(preferredLeft, viewportLeft),
        viewportRight - panelWidth,
      );
      setMenuRect({
        top: rect.bottom + window.scrollY + 10,
        left: clampedLeft,
        width: panelWidth,
      });
    };
    updateRect();
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [menuOpen]);

  const navClass = ({ isActive }) => `nav-pill ${isActive ? 'active' : ''}`;
  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="w-full border-b border-transparent bg-[var(--bg)]/60 backdrop-blur-xl sticky top-0 z-40">
      <div className="w-full px-6 lg:px-10 py-5 flex items-center gap-4 flex-wrap">
        <Link to="/" className="brand-mark mr-auto" onClick={closeMenu}>
          <span className="brand-mark__initial">B</span>
          <span className="brand-mark__rest">izscribe</span>
        </Link>

        <nav className="flex items-center gap-2 flex-wrap justify-center mx-auto">
          <NavLink to="/garage-sale" className={navClass} onClick={closeMenu}>
            Garage Sale
          </NavLink>
          <NavLink to="/register-business" className={navClass} onClick={closeMenu}>
            Add Business
          </NavLink>
          <NavLink to="/about" className={navClass} onClick={closeMenu}>
            About
          </NavLink>
          <NavLink to="/contact" className={navClass} onClick={closeMenu}>
            Contact
          </NavLink>
        </nav>

        <div className="ml-auto flex items-center gap-3" ref={menuRef}>
          {isAuthenticated ? (
            <div className="relative inline-flex">
              <button
                type="button"
                className="user-trigger"
                ref={userButtonRef}
                onClick={() => setMenuOpen((open) => !open)}
              >
                <span className="user-trigger__name">{user.display_name || user.email}</span>
                <span className="caret" />
              </button>

              {menuOpen && menuRect &&
                createPortal(
                  <div
                    ref={menuPanelRef}
                    className="dropdown-panel dropdown-panel--menu"
                    style={{ top: menuRect.top, left: menuRect.left, width: menuRect.width }}
                  >
                    {user?.role === 'ADMIN' && (
                      <Link to="/admin/submissions" className="dropdown-link" onClick={closeMenu}>
                        Admin
                      </Link>
                    )}
                    <Link to="/my/submissions" className="dropdown-link" onClick={closeMenu}>
                      My Submissions
                    </Link>
                    <button
                      type="button"
                      className="dropdown-link"
                      onClick={() => {
                        logout();
                        closeMenu();
                      }}
                    >
                      Logout
                    </button>
                  </div>,
                  document.body,
                )}
            </div>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost">
                Sign in
              </Link>
              <Link to="/register" className="btn btn-primary">
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
            <Route path="/garage-sale" element={<GarageSale />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/business/:id" element={<BusinessDetail />} />
            <Route path="/my/submissions" element={<MySubmissions />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
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
