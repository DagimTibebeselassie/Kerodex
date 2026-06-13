import { useState, useEffect, useRef } from 'react';
import { Link, Outlet, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { Button, Input } from '@blinkdotnew/ui';
import { listConversations } from '@/lib/api';
import { KERODEX_VERSION } from '@/version';
import {
  Search,
  Heart,
  MessageSquare,
  User,
  Menu,
  X,
  Moon,
  Sun,
  ChevronDown,
  LogOut,
  BadgeCheck,
  LayoutDashboard,
  Car,
} from 'lucide-react';
import { AuthModal } from './AuthModal';

function useDarkMode() {
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains('dark')
  );

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('kerodex_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('kerodex_theme', 'light');
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem('kerodex_theme');
    if (saved === 'dark') {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    } else if (saved === 'light') {
      document.documentElement.classList.remove('dark');
      setIsDark(false);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    }
  }, []);

  return { isDark, toggle };
}

export function Layout() {
  const { user, isLoading, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isDark, toggle: toggleDark } = useDarkMode();
  const firstName = (user?.name || user?.email || '').trim().split(/\s|@/)[0] || 'there';
  const userInitial = firstName.charAt(0).toUpperCase() || 'U';
  const { data: conversations = [] } = useQuery({
    queryKey: ['nav-unread-conversations', user?.id],
    queryFn: async () => user ? listConversations() : [],
    enabled: !!user,
    refetchInterval: 20000,
  });
  const unreadCount = conversations.reduce((sum, conversation) => sum + Number(conversation.unread || 0), 0);

  const [authOpen, setAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'signup'>('login');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [headerSearch, setHeaderSearch] = useState('');

  const userMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // Close user menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Lock scroll when mobile menu open
  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as { tab?: 'login' | 'signup' } | undefined;
      setAuthTab(detail?.tab || 'login');
      setAuthOpen(true);
    };
    window.addEventListener('kerodex:auth-required', handler);
    return () => window.removeEventListener('kerodex:auth-required', handler);
  }, []);

  const handleHeaderSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (headerSearch.trim()) {
      navigate({ to: '/cars', search: { q: headerSearch.trim() } as any });
      setHeaderSearch('');
    }
  };

  const openSignUp = () => { setAuthTab('signup'); setAuthOpen(true); };

  const handleLogout = async () => {
    setUserMenuOpen(false);
    setMobileMenuOpen(false);
    await logout();
    queryClient.clear();
    navigate({ to: '/' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header
        id="main-header"
        data-auth-state={user ? 'signed-in' : 'signed-out'}
        className="h-14 border-b border-border sticky top-0 bg-background z-50 flex items-center px-4 md:px-6 gap-3"
      >
        {/* Logo */}
        <Link
          to="/"
          className="text-[13px] font-black tracking-tighter uppercase shrink-0 hover:opacity-70 transition-opacity"
        >
          Kerodex
        </Link>

        {/* Desktop center search */}
        <form
          onSubmit={handleHeaderSearch}
          className="hidden md:flex flex-1 max-w-md mx-auto relative"
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            id="header-search-bar"
            type="search"
            placeholder="Search make, model, city..."
            value={headerSearch}
            onChange={(e) => setHeaderSearch(e.target.value)}
            className="pl-9 h-9 text-[12px] w-full"
          />
        </form>

        {/* Spacer on mobile */}
        <div className="flex-1 md:hidden" />

        {/* Right side actions */}
        <div className="flex items-center gap-1">
          {/* Dark mode toggle */}
          <button
            id="dark-mode-toggle"
            onClick={toggleDark}
            aria-label="Toggle dark mode"
            className="h-9 w-9 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {!isLoading && (
            <>
              {user ? (
                <>
                  <Link to="/saved" aria-label="Saved cars">
                    <button className="hidden md:flex h-9 w-9 items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                      <Heart className="h-4 w-4" />
                    </button>
                  </Link>
                  <Link to="/messages" aria-label="Messages">
                    <button className="relative hidden md:flex h-9 w-9 items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                      <MessageSquare className="h-4 w-4" />
                      {unreadCount > 0 && (
                        <span className="absolute right-1 top-1 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold leading-4 text-center">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                    </button>
                  </Link>

                  {/* User menu */}
                  <div ref={userMenuRef} className="relative hidden md:block">
                    <button
                      id="user-menu"
                      onClick={() => setUserMenuOpen((v) => !v)}
                      aria-expanded={userMenuOpen}
                      className="flex items-center gap-1.5 h-9 px-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-[12px] font-medium"
                    >
                      <span className="h-5 w-5 rounded-full bg-foreground text-background inline-flex items-center justify-center overflow-hidden text-[10px] font-bold">
                        {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" /> : userInitial}
                      </span>
                      <span className="hidden lg:block max-w-[100px] truncate">
                        Hi, {firstName}
                      </span>
                      <ChevronDown className={`h-3 w-3 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {userMenuOpen && (
                      <div className="absolute right-0 top-full mt-1 w-52 bg-background border border-border shadow-lg z-50 py-1">
                        <div className="px-3 py-2 border-b border-border">
                          <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
                        </div>
                        <Link to="/profile" onClick={() => setUserMenuOpen(false)}>
                          <div className="flex items-center gap-2.5 px-3 py-2 text-[13px] hover:bg-muted transition-colors cursor-pointer">
                            <User className="h-3.5 w-3.5 text-muted-foreground" /> Account
                          </div>
                        </Link>
                        <Link to="/saved" onClick={() => setUserMenuOpen(false)}>
                          <div className="flex items-center gap-2.5 px-3 py-2 text-[13px] hover:bg-muted transition-colors cursor-pointer">
                            <Heart className="h-3.5 w-3.5 text-muted-foreground" /> Saved Cars
                          </div>
                        </Link>
                        <Link to="/cockpit" onClick={() => setUserMenuOpen(false)}>
                          <div className="flex items-center gap-2.5 px-3 py-2 text-[13px] hover:bg-muted transition-colors cursor-pointer">
                            <LayoutDashboard className="h-3.5 w-3.5 text-muted-foreground" /> Seller Cockpit
                          </div>
                        </Link>
                        <Link to="/verify" onClick={() => setUserMenuOpen(false)}>
                          <div className="flex items-center gap-2.5 px-3 py-2 text-[13px] hover:bg-muted transition-colors cursor-pointer">
                            <BadgeCheck className="h-3.5 w-3.5 text-muted-foreground" /> Verification
                          </div>
                        </Link>
                        <div className="border-t border-border mt-1 pt-1">
                          <button
                            onClick={toggleDark}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] hover:bg-muted transition-colors text-left"
                          >
                            {isDark ? <Sun className="h-3.5 w-3.5 text-muted-foreground" /> : <Moon className="h-3.5 w-3.5 text-muted-foreground" />}
                            {isDark ? 'Light Mode' : 'Dark Mode'}
                          </button>
                          <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] hover:bg-muted transition-colors text-left text-destructive"
                          >
                            <LogOut className="h-3.5 w-3.5" /> Logout
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <Link to="/sell" className="hidden md:block">
                    <Button className="h-8 px-4 text-[11px] font-bold uppercase tracking-wider ml-1">
                      List Car
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/cars" className="hidden md:block">
                    <button className="h-9 px-3 text-[12px] text-muted-foreground hover:text-foreground transition-colors font-medium">
                      Browse
                    </button>
                  </Link>
                  <Link to="/sell" className="hidden md:block">
                    <Button variant="outline" className="h-8 px-3 text-[11px] font-bold uppercase tracking-wider">
                      Become a Seller
                    </Button>
                  </Link>
                  <Link to="/signin">
                    <Button className="h-8 px-4 text-[11px] font-bold uppercase tracking-wider">
                      Sign In
                    </Button>
                  </Link>
                </>
              )}
            </>
          )}

          {/* Mobile hamburger */}
          <button
            id="mobile-menu-btn"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Toggle mobile menu"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
            className="md:hidden h-9 w-9 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors ml-1"
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}
      <div
        id="mobile-menu"
        ref={mobileMenuRef}
        className={`fixed top-14 left-0 right-0 z-40 bg-background border-b border-border md:hidden transition-transform duration-200 ${
          mobileMenuOpen ? 'translate-y-0' : '-translate-y-full pointer-events-none'
        }`}
        role="dialog"
        aria-label="Mobile navigation"
      >
        {/* Mobile search */}
        <form onSubmit={handleHeaderSearch} className="p-4 border-b border-border relative">
          <Search className="absolute left-7 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            placeholder="Search make, model, city..."
            value={headerSearch}
            onChange={(e) => setHeaderSearch(e.target.value)}
            className="pl-9 h-9 text-[12px] w-full"
          />
        </form>

        <nav className="p-4 space-y-1">
          <Link
            to="/cars"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 text-[13px] font-medium hover:bg-muted transition-colors"
          >
            <Car className="h-4 w-4 text-muted-foreground" /> Browse Cars
          </Link>
          <Link
            to="/sell"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 text-[13px] font-medium hover:bg-muted transition-colors"
          >
            <Search className="h-4 w-4 text-muted-foreground" /> Sell Your Car
          </Link>

          {user ? (
            <>
              <div className="border-t border-border my-2" />
              <Link
                to="/saved"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 text-[13px] font-medium hover:bg-muted transition-colors"
              >
                <Heart className="h-4 w-4 text-muted-foreground" /> Saved
              </Link>
              <Link
                to="/messages"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 text-[13px] font-medium hover:bg-muted transition-colors"
              >
                <span className="relative">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  {unreadCount > 0 && (
                    <span className="absolute -right-2 -top-2 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold leading-4 text-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </span>
                Messages
              </Link>
              <Link
                to="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 text-[13px] font-medium hover:bg-muted transition-colors"
              >
                <User className="h-4 w-4 text-muted-foreground" /> Account
              </Link>
              <Link
                to="/cockpit"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 text-[13px] font-medium hover:bg-muted transition-colors"
              >
                <LayoutDashboard className="h-4 w-4 text-muted-foreground" /> Seller Cockpit
              </Link>
              <div className="border-t border-border my-2" />
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-[13px] font-medium hover:bg-muted transition-colors text-left text-destructive"
              >
                <LogOut className="h-4 w-4" /> Logout
              </button>
            </>
          ) : (
            <>
              <div className="border-t border-border my-2" />
              <Link
                to="/signin"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 text-[13px] font-medium hover:bg-muted transition-colors"
              >
                <User className="h-4 w-4 text-muted-foreground" /> Sign In
              </Link>
              <button
                onClick={() => { setMobileMenuOpen(false); openSignUp(); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-[13px] font-medium hover:bg-muted transition-colors text-left"
              >
                <BadgeCheck className="h-4 w-4 text-muted-foreground" /> Sign Up
              </button>
            </>
          )}
        </nav>
      </div>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="py-12 px-4 md:px-6 border-t border-border mt-20">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10 md:gap-12">
          <div className="md:col-span-2">
            <h3 className="text-[13px] font-black uppercase tracking-tighter mb-3">Kerodex</h3>
            <p className="text-[12px] text-muted-foreground max-w-xs leading-relaxed">
              A minimalist, private-party car marketplace. Verified listings. Fair prices. No dealer markup.
            </p>
          </div>

          <div>
            <h4 className="text-[10px] font-bold uppercase tracking-[0.18em] mb-4 text-muted-foreground">Marketplace</h4>
            <ul className="space-y-2.5">
              <li>
                <Link to="/cars" className="text-[12px] text-muted-foreground hover:text-foreground transition-colors">
                  Browse Cars
                </Link>
              </li>
              <li>
                <Link to="/sell" className="text-[12px] text-muted-foreground hover:text-foreground transition-colors">
                  Sell Your Car
                </Link>
              </li>
              <li>
                <Link to="/how-it-works" className="text-[12px] text-muted-foreground hover:text-foreground transition-colors">
                  How It Works
                </Link>
              </li>
              <li>
                <Link to="/saved" className="text-[12px] text-muted-foreground hover:text-foreground transition-colors">
                  Saved Listings
                </Link>
              </li>
              <li>
                <Link to="/messages" className="text-[12px] text-muted-foreground hover:text-foreground transition-colors">
                  Messages
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-[10px] font-bold uppercase tracking-[0.18em] mb-4 text-muted-foreground">Platform</h4>
            <ul className="space-y-2.5">
              <li>
                <Link to="/cockpit" className="text-[12px] text-muted-foreground hover:text-foreground transition-colors">
                  Seller Cockpit
                </Link>
              </li>
              <li>
                <Link to="/verify" className="text-[12px] text-muted-foreground hover:text-foreground transition-colors">
                  Verification
                </Link>
              </li>
              <li>
                <Link to="/about" className="text-[12px] text-muted-foreground hover:text-foreground transition-colors">
                  About
                </Link>
              </li>
              <li>
                <Link to="/safety" className="text-[12px] text-muted-foreground hover:text-foreground transition-colors">
                  Safety Center
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-[12px] text-muted-foreground hover:text-foreground transition-colors">
                  Contact
                </Link>
              </li>
              <li>
                <Link to="/terms" className="text-[12px] text-muted-foreground hover:text-foreground transition-colors">
                  Terms
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="text-[12px] text-muted-foreground hover:text-foreground transition-colors">
                  Privacy
                </Link>
              </li>
              <li>
                <a href="mailto:founder@kerodexofficial.com" className="text-[12px] text-muted-foreground hover:text-foreground transition-colors">
                  founder@kerodexofficial.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto pt-10 mt-10 border-t border-border flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <p className="text-[11px] text-muted-foreground">&copy; 2026 Kerodex Auto. All rights reserved. Kerodex v{KERODEX_VERSION}</p>
          <button
            onClick={toggleDark}
            className="flex items-center gap-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {isDark ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
            {isDark ? 'Light Mode' : 'Dark Mode'}
          </button>
        </div>
      </footer>

      <AuthModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        defaultTab={authTab}
      />
    </div>
  );
}
