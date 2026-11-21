import { useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import api from '../api/client';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false));
  useEffect(() => {
    const media = window.matchMedia(query);
    const handler = (event) => setMatches(event.matches);
    setMatches(media.matches);
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, [query]);
  return matches;
}

/**
 * Application shell.
 *
 * Desktop: the sidebar is collapsed to a slim rail (logo only) by default. It
 *          expands when the pointer reaches the left hot zone and collapses when
 *          the pointer leaves. `.main-area` animates its margin-left so the page
 *          content slides instead of being covered — no overlay, no layout jump.
 * Mobile:  a slide-over drawer driven by the header menu button.
 */
export function Layout() {
  const location = useLocation();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const canHover = useMediaQuery('(hover: hover) and (pointer: fine)');
  const [pinned, setPinned] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  // True right after the toggle button collapsed the rail: hover reveal is
  // suppressed until the pointer actually leaves the sidebar, so the click
  // result cannot be undone by the pointer still resting on the sidebar.
  const [hoverSuppressed, setHoverSuppressed] = useState(false);
  const [notifications, setNotifications] = useState({ lowStock: [], outOfStock: [], overdueBorrows: [], total: 0 });
  const hideTimer = useRef(null);

  const loadNotifications = useCallback(async () => {
    try {
      const data = await api.get('/dashboard/notifications');
      setNotifications(data);
    } catch {
      /* non-critical */
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications, location.pathname]);

  useEffect(() => {
    const interval = setInterval(loadNotifications, 60000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  useEffect(() => {
    setMobileOpen(false);
    setHovered(false);
    setHoverSuppressed(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  /**
   * The header button is a real toggle: it acts on what is *visible*.
   *  - collapsed  -> click 1 expands (and pins, so it stays open)
   *  - expanded   -> click 2 collapses (unpins + clears hover)
   * Hover-reveal never blocks the button, because `hoverSuppressed` is set
   * when collapsing so the resting pointer cannot immediately re-open it.
   */
  const handleMenuClick = () => {
    if (!isDesktop) {
      setMobileOpen((current) => !current);
      return;
    }
    const isVisible = pinned || hovered;
    if (isVisible) {
      setPinned(false);
      setHovered(false);
      setHoverSuppressed(true);
    } else {
      setPinned(true);
      setHoverSuppressed(false);
    }
  };

  const revealSidebar = () => {
    if (!isDesktop || !canHover || hoverSuppressed) return;
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setHovered(true);
  };

  const scheduleHide = () => {
    if (!isDesktop) return;
    // Leaving the sidebar always clears the suppression flag so hover works again.
    setHoverSuppressed(false);
    if (!canHover || pinned) return;
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setHovered(false), 180);
  };

  const sidebarOpen = isDesktop ? pinned || hovered : mobileOpen;
  const contentShifted = isDesktop && sidebarOpen;
  // Reports manages its own internal scroll area and needs a bounded height.
  const fullHeight = location.pathname === '/reports';

  return (
    <div
      className={[
        'app-shell',
        sidebarOpen ? 'sidebar-open' : 'sidebar-closed',
        contentShifted ? 'content-shifted' : '',
        pinned && isDesktop ? 'sidebar-pinned' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {isDesktop && canHover && !pinned && !hoverSuppressed && (
        <div className="sidebar-hotzone" onMouseEnter={revealSidebar} aria-hidden="true" />
      )}

      <Sidebar
        open={sidebarOpen}
        pinned={pinned}
        isMobile={!isDesktop}
        onClose={() => {
          if (isDesktop) {
            setPinned(false);
            setHovered(false);
            setHoverSuppressed(true);
          } else {
            setMobileOpen(false);
          }
        }}
        onReveal={revealSidebar}
        onHide={scheduleHide}
      />

      <div className="main-area">
        <Topbar
          onMenuClick={handleMenuClick}
          pinned={pinned && isDesktop}
          notifications={notifications}
          onRefreshNotifications={loadNotifications}
        />
        <main
          className={`content ${fullHeight ? 'content-fixed' : ''}`}
          onMouseEnter={scheduleHide}
          onFocus={scheduleHide}
          aria-live="polite"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
