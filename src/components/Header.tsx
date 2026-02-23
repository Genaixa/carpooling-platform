import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useIsMobile } from '../hooks/useIsMobile';
import Avatar from './Avatar';
import toast from 'react-hot-toast';
import type { NavigateFn } from '../lib/types';

interface HeaderProps {
  onNavigate: NavigateFn;
  currentPage?: string;
}

export default function Header({ onNavigate, currentPage }: HeaderProps) {
  const { user, profile, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [bookingNotifCount, setBookingNotifCount] = useState(0);
  const isMobile = useIsMobile(768);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const refreshNotifCount = async () => {
    if (!user) { setBookingNotifCount(0); return; }
    const lastSeen = localStorage.getItem('lastSeenBookings') || new Date(0).toISOString();
    const { count } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('passenger_id', user.id)
      .eq('status', 'confirmed')
      .gt('driver_action_at', lastSeen);
    setBookingNotifCount(count || 0);
  };

  useEffect(() => { refreshNotifCount(); }, [user]);

  useEffect(() => {
    const handler = () => setBookingNotifCount(0);
    window.addEventListener('bookings-seen', handler);
    return () => window.removeEventListener('bookings-seen', handler);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {
      // Ignore signOut errors (e.g. session already expired) — proceed anyway
    }
    setProfileDropdownOpen(false);
    setMobileMenuOpen(false);
    onNavigate('home');
  };

  const navLinkStyle = (active?: boolean) => ({
    background: 'none', border: 'none',
    color: active ? '#1A9D9D' : '#4B5563',
    fontSize: '17px', cursor: 'pointer' as const,
    fontWeight: active ? '800' : '700' as any,
    transition: 'color 0.3s', padding: 0,
  });

  const mobileLinkStyle = {
    textAlign: 'left' as const, color: '#4B5563',
    background: 'none', border: 'none', fontSize: '18px',
    cursor: 'pointer' as const, padding: '12px 0',
    fontWeight: '700' as any, width: '100%',
    borderBottom: '1px solid #F3F4F6',
  };

  const dropdownItemStyle = (danger?: boolean) => ({
    display: 'flex', alignItems: 'center', gap: '10px',
    width: '100%', padding: '10px 16px', background: 'none', border: 'none',
    fontSize: '15px', fontWeight: '600' as any, cursor: 'pointer' as const,
    color: danger ? '#DC2626' : '#374151', textAlign: 'left' as const,
    transition: 'background 0.15s',
  });

  return (
    <nav style={{
      backgroundColor: 'white',
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      position: 'sticky' as const, top: 0, zIndex: 40,
    }}>
      <div style={{
        maxWidth: '1200px', margin: '0 auto', padding: '0 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: isMobile ? '70px' : '88px',
      }}>
        {/* Logo */}
        <div
          style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0 }}
          onClick={() => { onNavigate('home'); setMobileMenuOpen(false); }}
        >
          <img src="/ChapaRideLogo.jpg" alt="ChapaRide"
            style={{ height: isMobile ? '60px' : '78px', width: 'auto', objectFit: 'contain' }} />
          <span style={{ fontSize: '22px', fontWeight: '800', marginLeft: '8px' }}>
            <span style={{ color: '#1A9D9D' }}>Chapa</span>
            <span style={{ color: '#8BC34A' }}>Ride</span>
          </span>
        </div>

        {/* Desktop Navigation */}
        {!isMobile && (
          <div style={{ display: 'flex', gap: '28px', alignItems: 'center' }}>
            {user && (
              <button onClick={() => onNavigate('home')} style={navLinkStyle(currentPage === 'home')}>
                Find a Ride
              </button>
            )}
            {user && profile?.is_approved_driver ? (
              <button onClick={() => onNavigate('post-ride')} style={navLinkStyle(currentPage === 'post-ride')}>
                Post a Ride
              </button>
            ) : user ? (
              <button onClick={() => onNavigate('driver-apply')} style={navLinkStyle(currentPage === 'driver-apply')}>
                Become a Driver
              </button>
            ) : null}
            <button onClick={() => onNavigate('how-it-works')} style={navLinkStyle(currentPage === 'how-it-works')}>
              How it Works
            </button>
            {user && profile?.is_admin && (
              <button
                onClick={() => onNavigate('admin-dashboard')}
                style={{
                  background: currentPage === 'admin-dashboard' ? '#1A9D9D' : 'linear-gradient(135deg, #1A9D9D, #8BC34A)',
                  color: 'white', border: 'none', borderRadius: '20px',
                  padding: '6px 16px', fontSize: '13px', fontWeight: '700',
                  cursor: 'pointer', letterSpacing: '0.3px',
                }}
              >
                🛡 Admin
              </button>
            )}
          </div>
        )}

        {/* Desktop right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          {!isMobile && user && (
            <div ref={dropdownRef} style={{ position: 'relative' }}>
              {/* Profile trigger */}
              <button
                onClick={() => setProfileDropdownOpen(o => !o)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  background: profileDropdownOpen ? '#F3F4F6' : 'none',
                  border: '1px solid', borderColor: profileDropdownOpen ? '#D1D5DB' : 'transparent',
                  borderRadius: '50px', padding: '6px 12px 6px 6px',
                  cursor: 'pointer', transition: 'all 0.2s',
                }}
              >
                <Avatar photoUrl={profile?.profile_photo_url} name={profile?.name || ''} size="sm" />
                <span style={{ fontSize: '16px', color: '#374151', fontWeight: '700' }}>My Account : {profile?.name}</span>
                {bookingNotifCount > 0 && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    minWidth: '18px', height: '18px', padding: '0 4px',
                    borderRadius: '9px', backgroundColor: '#ef4444', color: 'white',
                    fontSize: '11px', fontWeight: '700',
                  }}>
                    {bookingNotifCount}
                  </span>
                )}
                {/* Chevron */}
                <svg style={{ width: '14px', height: '14px', color: '#9CA3AF', transform: profileDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown */}
              {profileDropdownOpen && (
                <div style={{
                  position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                  backgroundColor: 'white', borderRadius: '16px',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.12)', border: '1px solid #E5E7EB',
                  minWidth: '200px', overflow: 'hidden', zIndex: 100,
                }}>
                  {/* User info header */}
                  <div style={{ padding: '14px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Avatar photoUrl={profile?.profile_photo_url} name={profile?.name || ''} size="md" />
                    <div>
                      <p style={{ margin: 0, fontWeight: '700', fontSize: '14px', color: '#1F2937' }}>{profile?.name}</p>
                      <p style={{ margin: 0, fontSize: '12px', color: '#9CA3AF' }}>{profile?.email}</p>
                    </div>
                  </div>

                  <div style={{ padding: '6px 0' }}>
                    <button
                      onClick={() => { onNavigate('my-bookings'); setProfileDropdownOpen(false); }}
                      style={dropdownItemStyle()}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F9FAFB')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <span>📋</span>
                      <span>My Bookings</span>
                      {bookingNotifCount > 0 && (
                        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '18px', height: '18px', padding: '0 4px', borderRadius: '9px', backgroundColor: '#ef4444', color: 'white', fontSize: '11px', fontWeight: '700' }}>
                          {bookingNotifCount}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => { onNavigate('ride-wishes'); setProfileDropdownOpen(false); }}
                      style={dropdownItemStyle()}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F9FAFB')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <span>🔔</span>
                      <span>Ride Alerts</span>
                    </button>
                    <button
                      onClick={() => { onNavigate('dashboard'); setProfileDropdownOpen(false); }}
                      style={dropdownItemStyle()}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F9FAFB')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <span>📊</span>
                      <span>Dashboard</span>
                    </button>
                    <button
                      onClick={() => { onNavigate('profile'); setProfileDropdownOpen(false); }}
                      style={dropdownItemStyle()}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F9FAFB')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <span>👤</span>
                      <span>Profile</span>
                    </button>
                    <div style={{ borderTop: '1px solid #F3F4F6', margin: '6px 0' }} />
                    <button
                      onClick={handleSignOut}
                      style={dropdownItemStyle(true)}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#FEF2F2')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <span>↩</span>
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {!isMobile && !user && (
            <>
              <button onClick={() => onNavigate('login')} className="header-cta-btn" style={{ padding: '12px 28px', background: 'white', color: '#1A9D9D', border: '3px solid #1A9D9D', borderRadius: '50px', fontSize: '16px', fontWeight: '700', cursor: 'pointer', letterSpacing: '0.3px', boxShadow: '0 2px 8px rgba(26,157,157,0.15)' }}>
                Login
              </button>
              <button onClick={() => onNavigate('register')} className="header-cta-btn" style={{ padding: '12px 28px', background: 'linear-gradient(135deg, #1A9D9D 0%, #15b3b3 50%, #8BC34A 100%)', color: 'white', borderRadius: '50px', fontSize: '16px', fontWeight: '700', border: 'none', cursor: 'pointer', letterSpacing: '0.3px', boxShadow: '0 4px 14px rgba(26,157,157,0.35)' }}>
                Sign Up to Ride
              </button>
              <button onClick={() => onNavigate('register-driver')} className="header-cta-btn" style={{ padding: '12px 28px', background: 'linear-gradient(135deg, #8BC34A 0%, #6fa832 100%)', color: 'white', borderRadius: '50px', fontSize: '16px', fontWeight: '700', border: 'none', cursor: 'pointer', letterSpacing: '0.3px', boxShadow: '0 4px 14px rgba(139,195,74,0.35)' }}>
                Sign Up to Drive
              </button>
            </>
          )}

          {/* Mobile Hamburger */}
          {isMobile && (
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{ padding: '8px', color: '#374151', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <svg style={{ width: '28px', height: '28px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen
                  ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobile && mobileMenuOpen && (
        <div style={{ padding: '8px 16px 16px', borderTop: '1px solid #F3F4F6', backgroundColor: 'white', boxShadow: '0 8px 20px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {user && (
              <button
                onClick={() => { onNavigate('profile'); setMobileMenuOpen(false); }}
                style={{ ...mobileLinkStyle, display: 'flex', alignItems: 'center', gap: '10px' }}
              >
                <Avatar photoUrl={profile?.profile_photo_url} name={profile?.name || ''} size="sm" />
                <span style={{ fontWeight: '600', color: '#1F2937' }}>{profile?.name}</span>
              </button>
            )}
            {user && (
              <button onClick={() => { onNavigate('home'); setMobileMenuOpen(false); }} style={mobileLinkStyle}>Find a Ride</button>
            )}
            {user && profile?.is_approved_driver ? (
              <button onClick={() => { onNavigate('post-ride'); setMobileMenuOpen(false); }} style={mobileLinkStyle}>Post a Ride</button>
            ) : user ? (
              <button onClick={() => { onNavigate('driver-apply'); setMobileMenuOpen(false); }} style={mobileLinkStyle}>Become a Driver</button>
            ) : null}
            <button onClick={() => { onNavigate('how-it-works'); setMobileMenuOpen(false); }} style={mobileLinkStyle}>How it Works</button>
            {user && (
              <>
                <button onClick={() => { onNavigate('my-bookings'); setMobileMenuOpen(false); }} style={{ ...mobileLinkStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  My Bookings
                  {bookingNotifCount > 0 && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '20px', height: '20px', padding: '0 5px', borderRadius: '10px', backgroundColor: '#ef4444', color: 'white', fontSize: '12px', fontWeight: '700' }}>
                      {bookingNotifCount}
                    </span>
                  )}
                </button>
                <button onClick={() => { onNavigate('ride-wishes'); setMobileMenuOpen(false); }} style={mobileLinkStyle}>Ride Alerts</button>
                <button onClick={() => { onNavigate('dashboard'); setMobileMenuOpen(false); }} style={mobileLinkStyle}>Dashboard</button>
                {profile?.is_admin && (
                  <button onClick={() => { onNavigate('admin-dashboard'); setMobileMenuOpen(false); }} style={{ ...mobileLinkStyle, color: '#1A9D9D', fontWeight: '700' }}>
                    🛡 Admin
                  </button>
                )}
                <button onClick={() => { handleSignOut(); setMobileMenuOpen(false); }} style={{ ...mobileLinkStyle, color: '#dc2626', borderBottom: 'none' }}>
                  Sign Out
                </button>
              </>
            )}
            {!user && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '16px' }}>
                <button onClick={() => { onNavigate('login'); setMobileMenuOpen(false); }} style={{ width: '100%', padding: '16px', background: 'white', color: '#1A9D9D', border: '3px solid #1A9D9D', borderRadius: '50px', fontSize: '18px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 2px 8px rgba(26,157,157,0.15)' }}>Login</button>
                <button onClick={() => { onNavigate('register'); setMobileMenuOpen(false); }} style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, #1A9D9D 0%, #15b3b3 50%, #8BC34A 100%)', color: 'white', borderRadius: '50px', fontSize: '18px', fontWeight: '700', border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(26,157,157,0.35)' }}>Sign Up to Ride</button>
                <button onClick={() => { onNavigate('register-driver'); setMobileMenuOpen(false); }} style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, #8BC34A 0%, #6fa832 100%)', color: 'white', borderRadius: '50px', fontSize: '18px', fontWeight: '700', border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(139,195,74,0.35)' }}>Sign Up to Drive</button>
              </div>
            )}
          </div>
        </div>
      )}
      <style>{`
        .header-cta-btn:hover { transform: translateY(-2px) scale(1.03); filter: brightness(1.08); }
        .header-cta-btn { transition: all 0.2s ease; }
      `}</style>
    </nav>
  );
}
