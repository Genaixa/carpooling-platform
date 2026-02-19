import { useEffect, useState } from 'react';
import type { NavigateFn } from '../lib/types';

interface PaymentSuccessProps {
  onNavigate: NavigateFn;
}

export default function PaymentSuccess({ onNavigate }: PaymentSuccessProps) {
  const [countdown, setCountdown] = useState(8);

  useEffect(() => {
    window.history.replaceState({}, '', '/');
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          onNavigate('my-bookings');
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
        maxWidth: '520px',
        width: '100%',
        textAlign: 'center',
      }}>
        {/* Icon */}
        <div style={{
          width: '80px', height: '80px', borderRadius: '50%',
          backgroundColor: '#dcfce7', display: 'flex', alignItems: 'center',
          justifyContent: 'center', margin: '0 auto 24px',
        }}>
          <svg width="40" height="40" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        {/* Heading */}
        <h2 style={{ fontSize: '26px', fontWeight: '800', color: '#1F2937', marginBottom: '8px' }}>
          Payment Authorised
        </h2>
        <p style={{ fontSize: '16px', color: '#6B7280', marginBottom: '28px' }}>
          Your booking request has been sent to the driver
        </p>

        {/* Status box */}
        <div style={{
          backgroundColor: '#fffbeb',
          border: '2px solid #fde68a',
          borderRadius: '16px',
          padding: '20px 24px',
          marginBottom: '28px',
          textAlign: 'left',
        }}>
          <p style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: '700', color: '#92400e' }}>
            Awaiting Driver Confirmation
          </p>
          <p style={{ margin: 0, fontSize: '14px', color: '#78350f', lineHeight: '1.6' }}>
            Your card has been authorised but <strong>not yet charged</strong>. The driver will review your request and accept or reject it. You will only be charged if the driver accepts.
          </p>
        </div>

        {/* What happens next */}
        <div style={{
          backgroundColor: '#f8fafc',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '28px',
          textAlign: 'left',
        }}>
          <p style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: '700', color: '#374151' }}>What happens next:</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              'The driver receives your booking request by email',
              'They accept or reject it — you\'ll be notified by email either way',
              'If accepted, your card is charged and the booking is confirmed',
              'Driver contact details are shared 12 hours before departure',
            ].map((step, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <span style={{
                  flexShrink: 0, width: '20px', height: '20px', borderRadius: '50%',
                  backgroundColor: '#1A9D9D', color: 'white', fontSize: '11px',
                  fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {i + 1}
                </span>
                <span style={{ fontSize: '13px', color: '#4B5563', lineHeight: '1.5' }}>{step}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA button */}
        <button
          onClick={() => onNavigate('my-bookings')}
          style={{
            width: '100%', padding: '16px',
            background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)',
            color: 'white', border: 'none', borderRadius: '12px',
            fontSize: '16px', fontWeight: '700', cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(26,157,157,0.25)',
            marginBottom: '12px',
          }}
        >
          View My Bookings
        </button>

        <p style={{ fontSize: '13px', color: '#9CA3AF', margin: 0 }}>
          Redirecting automatically in {countdown} second{countdown !== 1 ? 's' : ''}...
        </p>
      </div>
    </div>
  );
}
