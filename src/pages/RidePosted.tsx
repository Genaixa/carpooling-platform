import { useEffect, useState } from 'react';
import type { NavigateFn } from '../lib/types';

interface Props {
  onNavigate: NavigateFn;
}

export default function RidePosted({ onNavigate }: Props) {
  const [countdown, setCountdown] = useState(20);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          onNavigate('home');
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [onNavigate]);

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#F8FAFB',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '24px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.1)',
        padding: '48px 40px',
        maxWidth: '560px',
        width: '100%',
        textAlign: 'center',
      }}>
        {/* Icon */}
        <div style={{
          width: '80px', height: '80px', borderRadius: '50%',
          backgroundColor: '#dcfce7',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px',
        }}>
          <svg width="40" height="40" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        {/* Heading */}
        <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#1F2937', marginBottom: '8px' }}>
          Ride Successfully Posted!
        </h1>
        <p style={{ fontSize: '16px', color: '#6B7280', marginBottom: '28px' }}>
          Your ride is now live and visible to passengers.
        </p>

        {/* What happens next */}
        <div style={{
          backgroundColor: '#f0fdf4',
          border: '2px solid #bbf7d0',
          borderRadius: '16px',
          padding: '20px 24px',
          marginBottom: '28px',
          textAlign: 'left',
        }}>
          <p style={{ margin: '0 0 14px 0', fontSize: '15px', fontWeight: '700', color: '#166534' }}>
            Sit back and wait for ride requests:
          </p>
          {[
            'Passengers can now find and book your ride.',
            "You'll receive an email the moment someone requests to book.",
            'You can accept or decline each booking request from the email or your dashboard.',
            "Once you accept, the passenger's card is charged and their contact details will be shared with you 12 hours before departure.",
          ].map((step, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: i < 3 ? '10px' : 0 }}>
              <span style={{
                flexShrink: 0, width: '22px', height: '22px', borderRadius: '50%',
                backgroundColor: '#16a34a', color: 'white', fontSize: '12px',
                fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {i + 1}
              </span>
              <span style={{ fontSize: '14px', color: '#166534', lineHeight: '1.5' }}>{step}</span>
            </div>
          ))}
        </div>

        {/* Buttons */}
        <button
          onClick={() => onNavigate('dashboard')}
          style={{
            width: '100%', padding: '16px',
            background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)',
            color: 'white', border: 'none', borderRadius: '12px',
            fontSize: '16px', fontWeight: '700', cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(26,157,157,0.25)',
            marginBottom: '12px',
          }}
        >
          Go to Dashboard
        </button>
        <button
          onClick={() => onNavigate('post-ride')}
          style={{
            width: '100%', padding: '14px',
            background: 'none', color: '#6B7280',
            border: '1px solid #E5E7EB', borderRadius: '12px',
            fontSize: '15px', fontWeight: '600', cursor: 'pointer',
          }}
        >
          Post Another Ride
        </button>

        <p style={{ marginTop: '20px', fontSize: '13px', color: '#9CA3AF' }}>
          Redirecting to homepage in {countdown}s…
        </p>
      </div>
    </div>
  );
}
