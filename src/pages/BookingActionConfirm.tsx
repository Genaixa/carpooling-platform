import type { NavigateFn } from '../lib/types';

interface Props {
  onNavigate: NavigateFn;
  action: 'accepted' | 'rejected';
}

export default function BookingActionConfirm({ onNavigate, action }: Props) {
  const accepted = action === 'accepted';

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
        maxWidth: '540px',
        width: '100%',
        textAlign: 'center',
      }}>
        {/* Icon */}
        <div style={{
          width: '80px', height: '80px', borderRadius: '50%',
          backgroundColor: accepted ? '#dcfce7' : '#fee2e2',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px',
        }}>
          {accepted ? (
            <svg width="40" height="40" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="40" height="40" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          )}
        </div>

        {/* Heading */}
        <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#1F2937', marginBottom: '8px' }}>
          {accepted ? 'Booking Request Accepted' : 'Booking Request Declined'}
        </h1>
        <p style={{ fontSize: '16px', color: '#6B7280', marginBottom: '28px' }}>
          {accepted
            ? 'You have successfully accepted this booking.'
            : 'You have declined this booking request.'}
        </p>

        {/* Details box */}
        <div style={{
          backgroundColor: accepted ? '#f0fdf4' : '#fef2f2',
          border: `2px solid ${accepted ? '#bbf7d0' : '#fecaca'}`,
          borderRadius: '16px',
          padding: '20px 24px',
          marginBottom: '28px',
          textAlign: 'left',
        }}>
          {accepted ? (
            <>
              <p style={{ margin: '0 0 10px 0', fontSize: '15px', fontWeight: '700', color: '#166534' }}>
                What happens next:
              </p>
              {[
                'The passenger has been notified by email that their booking is confirmed.',
                "The passenger's contact details will become available to you 24 hours before the ride.",
                'You can view and manage all your bookings from your dashboard.',
              ].map((step, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: i < 2 ? '10px' : 0 }}>
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
            </>
          ) : (
            <>
              <p style={{ margin: '0 0 8px 0', fontSize: '15px', fontWeight: '700', color: '#991b1b' }}>
                Booking declined
              </p>
              <p style={{ margin: 0, fontSize: '14px', color: '#991b1b', lineHeight: '1.6' }}>
                The passenger has been notified by email. The hold on their card has been released and they will not be charged. Your seat availability has not changed.
              </p>
            </>
          )}
        </div>

        {/* CTA */}
        <button
          onClick={() => onNavigate('dashboard')}
          style={{
            width: '100%', padding: '16px',
            background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)',
            color: 'white', border: 'none', borderRadius: '12px',
            fontSize: '16px', fontWeight: '700', cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(26,157,157,0.25)',
          }}
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}
