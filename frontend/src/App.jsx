// frontend/src/App.jsx
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BrowserRouter, Routes, Route, NavLink, Link } from 'react-router-dom';
import { ScrollText } from 'lucide-react';
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
  const menuButtonRef = useRef(null);
  const menuPanelRef = useRef(null);
  const [menuRect, setMenuRect] = useState(null);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const primaryNavLinks = [
    { to: '/register-business', label: 'Add Business', className: 'nav-pill--cta' },
    { to: '/about', label: 'About' },
    { to: '/contact', label: 'Contact' },
  ];

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (event) => {
      const menuEl = menuRef.current;
      const buttonEl = menuButtonRef.current;
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
      const buttonEl = menuButtonRef.current;
      if (!buttonEl) return;
      const rect = buttonEl.getBoundingClientRect();
      setMenuRect({
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX,
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

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mq = window.matchMedia('(max-width: 640px)');
    const update = () => setNavCollapsed(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const navClass = ({ isActive }, extra = '') =>
    `nav-pill ${isActive ? 'active' : ''} ${extra}`.trim();
  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="app-header">
      <div className="app-header__inner" ref={menuRef}>
        <Link to="/" className="brand-mark" onClick={closeMenu}>
          <span className="brand-mark__initial">B</span>
          <span className="brand-mark__rest">izscribe</span>
        </Link>

        <nav className={`header-nav${navCollapsed ? ' header-nav--hidden' : ''}`}>
          {primaryNavLinks.map(({ to, label, className: extraClass = '' }) => (
            <NavLink
              key={to}
              to={to}
              className={(args) => navClass(args, extraClass)}
              onClick={closeMenu}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="header-menu">
          <button
            type="button"
            className="menu-trigger"
            ref={menuButtonRef}
            aria-label="Open account menu"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <ScrollText aria-hidden="true" />
          </button>
        </div>

        {menuOpen && menuRect &&
          createPortal(
            <div
              ref={menuPanelRef}
              className="dropdown-panel dropdown-panel--menu header-menu__panel"
              style={
                navCollapsed
                  ? { top: menuRect.top + 8, right: 12, left: 'auto', width: 'auto', maxWidth: '260px' }
                  : { top: menuRect.top, left: menuRect.left }
              }
            >
              <div className="header-menu__group">
                <Link to="/register-business" className="header-menu__link" onClick={closeMenu}>
                  Add Business
                </Link>
                <Link to="/garage-sale" className="header-menu__link" onClick={closeMenu}>
                  Garage Sale
                </Link>
              </div>
              {navCollapsed && (
                <div className="header-menu__group">
                  {primaryNavLinks
                    .filter(({ to }) => to !== '/register-business')
                    .map(({ to, label }) => (
                      <Link key={to} to={to} className="header-menu__link" onClick={closeMenu}>
                        {label}
                      </Link>
                    ))}
                </div>
              )}
              <div className="header-menu__divider" />
              <div className="header-menu__group">
                <p className="header-menu__label">Account</p>
                {isAuthenticated ? (
                  <>
                    <div className="header-menu__identity">
                      Signed in as <strong>{user.display_name || user.email}</strong>
                    </div>
                    <Link to="/my/submissions" className="header-menu__link" onClick={closeMenu}>
                      My Submissions
                    </Link>
                    {user?.role === 'ADMIN' && (
                      <Link to="/admin/submissions" className="header-menu__link" onClick={closeMenu}>
                        Admin
                      </Link>
                    )}
                    <button
                      type="button"
                      className="header-menu__link"
                      onClick={() => {
                        logout();
                        closeMenu();
                      }}
                    >
                      Sign out
                    </button>
                  </>
                ) : (
                  <>
                    <Link to="/login" className="header-menu__link" onClick={closeMenu}>
                      Sign in
                    </Link>
                    <Link to="/register" className="header-menu__link" onClick={closeMenu}>
                      Sign up
                    </Link>
                  </>
                )}
              </div>
            </div>,
            document.body,
          )}
      </div>
    </header>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex flex-col min-h-screen bg-[var(--bg)] text-[var(--text)]">
        <Header />

        <main className="flex-1">
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
