import type { NavigateFn } from '../lib/types';
import { useIsMobile } from '../hooks/useIsMobile';

interface FooterProps {
  onNavigate: NavigateFn;
}

export default function Footer({ onNavigate }: FooterProps) {
  const isMobile = useIsMobile(768);

  const handleNavigate = (page: Parameters<NavigateFn>[0]) => {
    onNavigate(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const columnHeadingStyle: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: 700,
    color: '#FFFFFF',
    marginBottom: '16px',
  };

  const linkStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: '#D1D5DB',
    fontSize: '14px',
    cursor: 'pointer',
    padding: 0,
    textAlign: 'left',
    lineHeight: '1.8',
    transition: 'color 0.2s',
    fontFamily: 'inherit',
  };

  const plainTextStyle: React.CSSProperties = {
    color: '#9CA3AF',
    fontSize: '14px',
    lineHeight: '1.8',
    margin: 0,
  };

  return (
    <footer style={{ backgroundColor: '#1F2937', color: '#D1D5DB' }}>
      {/* Main footer content */}
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: isMobile ? '40px 20px 32px' : '56px 24px 40px',
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)',
          gap: isMobile ? '36px' : '40px',
        }}
      >
        {/* Column 1: Brand */}
        <div>
          <div
            style={{
              fontSize: '22px',
              fontWeight: 800,
              marginBottom: '12px',
              background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            ChapaRide
          </div>
          <p style={{ color: '#9CA3AF', fontSize: '14px', lineHeight: '1.7', margin: '0 0 20px 0' }}>
            Safe, affordable carpooling across the UK. Share rides, save money, make friends.
          </p>
        </div>

        {/* Column 2: Quick Links */}
        <div>
          <h4 style={columnHeadingStyle}>Quick Links</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <button
              onClick={() => handleNavigate('home')}
              style={linkStyle}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#8BC34A')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#D1D5DB')}
            >
              Find a Ride
            </button>
            <button
              onClick={() => handleNavigate('how-it-works')}
              style={linkStyle}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#8BC34A')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#D1D5DB')}
            >
              How it Works
            </button>
            <button
              onClick={() => handleNavigate('driver-apply')}
              style={linkStyle}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#8BC34A')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#D1D5DB')}
            >
              Become a Driver
            </button>
            <button
              onClick={() => handleNavigate('post-ride')}
              style={linkStyle}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#8BC34A')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#D1D5DB')}
            >
              Post a Ride
            </button>
          </div>
        </div>

        {/* Column 3: Support */}
        <div>
          <h4 style={columnHeadingStyle}>Support</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <button
              onClick={() => handleNavigate('contact')}
              style={linkStyle}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#8BC34A')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#D1D5DB')}
            >
              Contact Us
            </button>
            <button
              onClick={() => handleNavigate('terms')}
              style={linkStyle}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#8BC34A')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#D1D5DB')}
            >
              Terms &amp; Conditions
            </button>
            <button
              onClick={() => handleNavigate('privacy-policy')}
              style={linkStyle}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#8BC34A')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#D1D5DB')}
            >
              Privacy Policy
            </button>
            <button
              onClick={() => handleNavigate('faqs')}
              style={linkStyle}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#8BC34A')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#D1D5DB')}
            >
              FAQs
            </button>
          </div>
        </div>

        {/* Column 4: Contact */}
        <div>
          <h4 style={columnHeadingStyle}>Contact</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1A9D9D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              <a
                href="mailto:info@chaparide.com"
                style={{
                  color: '#D1D5DB',
                  fontSize: '14px',
                  textDecoration: 'none',
                  transition: 'color 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#8BC34A')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#D1D5DB')}
              >
                info@chaparide.com
              </a>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1A9D9D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
              </svg>
              <span style={plainTextStyle}>Coming soon</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1A9D9D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: '2px', flexShrink: 0 }}>
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span style={plainTextStyle}>Coming soon</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div
        style={{
          borderTop: '1px solid rgba(255,255,255,0.1)',
          backgroundColor: '#1a2332',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            padding: isMobile ? '20px' : '20px 24px',
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: isMobile ? '8px' : '0',
          }}
        >
          <span style={{ color: '#9CA3AF', fontSize: '13px' }}>
            &copy; 2026 ChapaRide. All rights reserved.
          </span>
          <span style={{ color: '#9CA3AF', fontSize: '13px' }}>
            Designed by{' '}
            <a
              href="https://www.genaixa.co.uk"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#1A9D9D',
                textDecoration: 'none',
                fontWeight: 600,
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#8BC34A')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#1A9D9D')}
            >
              Genaixa Ltd
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
