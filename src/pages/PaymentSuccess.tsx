import { useEffect, useState } from 'react';
import type { NavigateFn } from '../lib/types';

interface PaymentSuccessProps {
  onNavigate: NavigateFn;
}

export default function PaymentSuccess({ onNavigate }: PaymentSuccessProps) {
  const [status] = useState<'success'>('success');

  useEffect(() => {
    // Clean up URL
    window.history.replaceState({}, '', '/');
    // Redirect to my bookings after a short delay
    const timer = setTimeout(() => onNavigate('my-bookings'), 3000);
    return () => clearTimeout(timer);
  }, [onNavigate]);

  return (
    <div style={{
      minHeight: '100vh', backgroundColor: '#F8FAFB',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
    }}>
      <div style={{
        backgroundColor: 'white', borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
        padding: '48px', maxWidth: '480px', width: '100%', textAlign: 'center',
      }}>
        {status === 'success' && (
          <>
            <div style={{ color: '#10bd59', fontSize: '64px', marginBottom: '16px' }}>&#10003;</div>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1F2937', marginBottom: '8px' }}>
              Booking Request Sent!
            </h2>
            <p style={{ color: '#4B5563', marginBottom: '8px' }}>
              Your card has been authorised. You will only be charged when the driver accepts your booking.
            </p>
            <p style={{ fontSize: '14px', color: '#6B7280' }}>
              Redirecting to your bookings...
            </p>
          </>
        )}
      </div>
    </div>
  );
}
