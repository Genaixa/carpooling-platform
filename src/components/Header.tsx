import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
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
  const isMobile = useIsMobile(768);

  const handleSignOut = async () => {
    try {
      await signOut();
      onNavigate('home');
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error('Error signing out');
    }
  };

  const navLinkStyle = (active?: boolean) => ({
    background: 'none',
    border: 'none',
    color: active ? '#1A9D9D' : '#4B5563',
    fontSize: '15px',
    cursor: 'pointer' as const,
    fontWeight: active ? '700' : '500' as any,
    transition: 'color 0.3s',
    padding: 0,
  });

  const mobileLinkStyle = {
    textAlign: 'left' as const,
    color: '#4B5563',
    background: 'none',
    border: 'none',
    fontSize: '16px',
    cursor: 'pointer' as const,
    padding: '12px 0',
    fontWeight: '500' as any,
    width: '100%',
    borderBottom: '1px solid #F3F4F6',
  };

  return (
    <nav style={{
      backgroundColor: 'white',
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      position: 'sticky' as const,
      top: 0,
      zIndex: 40,
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '0 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: isMobile ? '70px' : '88px',
      }}>
        {/* Logo */}
        <div
          style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0 }}
          onClick={() => { onNavigate('home'); setMobileMenuOpen(false); }}
        >
          <img
            src="/ChapaRideLogo.jpg"
            alt="ChapaRide"
            style={{ height: isMobile ? '60px' : '78px', width: 'auto', objectFit: 'contain' }}
          />
          <span style={{ fontSize: '22px', fontWeight: '800', marginLeft: '8px' }}>
            <span style={{ color: '#1A9D9D' }}>Chapa</span>
            <span style={{ color: '#8BC34A' }}>Ride</span>
          </span>
        </div>

        {/* Desktop Navigation */}
        {!isMobile && (
          <div style={{ display: 'flex', gap: '28px', alignItems: 'center' }}>
            <button onClick={() => onNavigate('home')} style={navLinkStyle(currentPage === 'home')}>
              Find a Ride
            </button>
            {user && profile?.is_approved_driver ? (
              <button onClick={() => onNavigate('post-ride')} style={navLinkStyle(currentPage === 'post-ride')}>
                Post a Ride
              </button>
            ) : user ? (
              <button onClick={() => onNavigate('driver-apply')} style={navLinkStyle(currentPage === 'driver-apply')}>
                Become a Driver
              </button>
            ) : (
              <button onClick={() => onNavigate('register-driver')} style={navLinkStyle(currentPage === 'post-ride')}>
                Post a Ride
              </button>
            )}
            <button onClick={() => onNavigate('how-it-works')} style={navLinkStyle(currentPage === 'how-it-works')}>How it Works</button>
            {user && (
              <>
                <button onClick={() => onNavigate('my-bookings')} style={navLinkStyle(currentPage === 'my-bookings')}>
                  My Bookings
                </button>
                <button onClick={() => onNavigate('ride-wishes')} style={navLinkStyle(currentPage === 'ride-wishes')}>
                  Ride Alerts
                </button>
                <button onClick={() => onNavigate('dashboard')} style={navLinkStyle(currentPage === 'dashboard')}>
                  Dashboard
                </button>
                {profile?.is_admin && (
                  <button
                    onClick={() => onNavigate('admin-dashboard')}
                    style={{ ...navLinkStyle(currentPage === 'admin-dashboard'), color: '#1A9D9D', fontWeight: '600' }}
                  >
                    Admin
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Desktop Auth + Mobile Hamburger */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          {!isMobile && user && (
            <>
              <button
                onClick={() => onNavigate('profile')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                }}
              >
                <span style={{ fontSize: '14px', color: '#374151', fontWeight: '600' }}>{profile?.name}</span>
              </button>
              <button
                onClick={handleSignOut}
                style={{
                  padding: '8px 20px',
                  background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)',
                  color: 'white', borderRadius: '50px', fontSize: '14px', fontWeight: '600',
                  border: 'none', cursor: 'pointer',
                }}
              >
                Sign Out
              </button>
            </>
          )}
          {!isMobile && !user && (
            <>
              <button
                onClick={() => onNavigate('login')}
                className="header-cta-btn"
                style={{
                  padding: '12px 28px', background: 'white', color: '#1A9D9D',
                  border: '3px solid #1A9D9D', borderRadius: '50px', fontSize: '16px',
                  fontWeight: '700', cursor: 'pointer', letterSpacing: '0.3px',
                  boxShadow: '0 2px 8px rgba(26,157,157,0.15)',
                }}
              >
                Login
              </button>
              <button
                onClick={() => onNavigate('register')}
                className="header-cta-btn"
                style={{
                  padding: '12px 28px',
                  background: 'linear-gradient(135deg, #1A9D9D 0%, #15b3b3 50%, #8BC34A 100%)',
                  color: 'white', borderRadius: '50px', fontSize: '16px', fontWeight: '700',
                  border: 'none', cursor: 'pointer', letterSpacing: '0.3px',
                  boxShadow: '0 4px 14px rgba(26,157,157,0.35)',
                }}
              >
                Sign Up to Ride
              </button>
              <button
                onClick={() => onNavigate('register-driver')}
                className="header-cta-btn"
                style={{
                  padding: '12px 28px',
                  background: 'linear-gradient(135deg, #8BC34A 0%, #6fa832 100%)',
                  color: 'white', borderRadius: '50px', fontSize: '16px', fontWeight: '700',
                  border: 'none', cursor: 'pointer', letterSpacing: '0.3px',
                  boxShadow: '0 4px 14px rgba(139,195,74,0.35)',
                }}
              >
                Sign Up to Drive
              </button>
            </>
          )}

          {/* Mobile Hamburger */}
          {isMobile && (
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{
                padding: '8px', color: '#374151', background: 'none',
                border: 'none', cursor: 'pointer',
              }}
            >
              <svg style={{ width: '28px', height: '28px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMobile && mobileMenuOpen && (
        <div style={{
          padding: '8px 16px 16px', borderTop: '1px solid #F3F4F6', backgroundColor: 'white',
          boxShadow: '0 8px 20px rgba(0,0,0,0.1)',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {user && (
              <button
                onClick={() => { onNavigate('profile'); setMobileMenuOpen(false); }}
                style={{ ...mobileLinkStyle, display: 'flex', alignItems: 'center', gap: '10px' }}
              >
                <span style={{ fontWeight: '600', color: '#1F2937' }}>{profile?.name}</span>
              </button>
            )}
            <button onClick={() => { onNavigate('home'); setMobileMenuOpen(false); }} style={mobileLinkStyle}>
              Find a Ride
            </button>
            {user && profile?.is_approved_driver ? (
              <button onClick={() => { onNavigate('post-ride'); setMobileMenuOpen(false); }} style={mobileLinkStyle}>
                Post a Ride
              </button>
            ) : user ? (
              <button onClick={() => { onNavigate('driver-apply'); setMobileMenuOpen(false); }} style={mobileLinkStyle}>
                Become a Driver
              </button>
            ) : (
              <button onClick={() => { onNavigate('register-driver'); setMobileMenuOpen(false); }} style={mobileLinkStyle}>
                Post a Ride
              </button>
            )}
            <button onClick={() => { onNavigate('how-it-works'); setMobileMenuOpen(false); }} style={mobileLinkStyle}>
              How it Works
            </button>
            {user && (
              <>
                <button onClick={() => { onNavigate('my-bookings'); setMobileMenuOpen(false); }} style={mobileLinkStyle}>
                  My Bookings
                </button>
                <button onClick={() => { onNavigate('ride-wishes'); setMobileMenuOpen(false); }} style={mobileLinkStyle}>
                  Ride Alerts
                </button>
                <button onClick={() => { onNavigate('dashboard'); setMobileMenuOpen(false); }} style={mobileLinkStyle}>
                  Dashboard
                </button>
                {profile?.is_admin && (
                  <button onClick={() => { onNavigate('admin-dashboard'); setMobileMenuOpen(false); }} style={{ ...mobileLinkStyle, color: '#1A9D9D', fontWeight: '600' }}>
                    Admin
                  </button>
                )}
                <button
                  onClick={() => { handleSignOut(); setMobileMenuOpen(false); }}
                  style={{ ...mobileLinkStyle, color: '#dc2626', borderBottom: 'none' }}
                >
                  Sign Out
                </button>
              </>
            )}
            {!user && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '16px' }}>
                <button
                  onClick={() => { onNavigate('login'); setMobileMenuOpen(false); }}
                  style={{
                    width: '100%', padding: '16px', background: 'white', color: '#1A9D9D',
                    border: '3px solid #1A9D9D', borderRadius: '50px', fontSize: '18px',
                    fontWeight: '700', cursor: 'pointer', letterSpacing: '0.3px',
                    boxShadow: '0 2px 8px rgba(26,157,157,0.15)',
                  }}
                >
                  Login
                </button>
                <button
                  onClick={() => { onNavigate('register'); setMobileMenuOpen(false); }}
                  style={{
                    width: '100%', padding: '16px',
                    background: 'linear-gradient(135deg, #1A9D9D 0%, #15b3b3 50%, #8BC34A 100%)',
                    color: 'white', borderRadius: '50px', fontSize: '18px',
                    fontWeight: '700', border: 'none', cursor: 'pointer', letterSpacing: '0.3px',
                    boxShadow: '0 4px 14px rgba(26,157,157,0.35)',
                  }}
                >
                  Sign Up to Ride
                </button>
                <button
                  onClick={() => { onNavigate('register-driver'); setMobileMenuOpen(false); }}
                  style={{
                    width: '100%', padding: '16px',
                    background: 'linear-gradient(135deg, #8BC34A 0%, #6fa832 100%)',
                    color: 'white', borderRadius: '50px', fontSize: '18px',
                    fontWeight: '700', border: 'none', cursor: 'pointer', letterSpacing: '0.3px',
                    boxShadow: '0 4px 14px rgba(139,195,74,0.35)',
                  }}
                >
                  Sign Up to Drive
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      <style>{`
        .header-cta-btn:hover {
          transform: translateY(-2px) scale(1.03);
          filter: brightness(1.08);
        }
        .header-cta-btn {
          transition: all 0.2s ease;
        }
      `}</style>
    </nav>
  );
}
