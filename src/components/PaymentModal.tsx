import { useState, useEffect, useRef } from 'react';
import { useIsMobile } from '../hooks/useIsMobile';

const API_URL = import.meta.env.VITE_API_URL || (window.location.protocol === 'https:' ? '' : 'http://srv1291941.hstgr.cloud:3001');

declare global {
  interface Window {
    Square: any;
  }
}

interface PaymentModalProps {
  amount: number;
  rideId: string;
  userId: string;
  seatsToBook: number;
  rideName: string;
  bookingForSomeoneElse?: boolean;
  bookingForGender?: 'Male' | 'Female';
  onSuccess: (paymentId: string) => void;
  onCancel: () => void;
}

export default function PaymentModal({ amount, rideId, userId, seatsToBook, rideName, bookingForSomeoneElse, bookingForGender, onSuccess, onCancel }: PaymentModalProps) {
  const isMobile = useIsMobile();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardReady, setCardReady] = useState(false);
  const [passengerAgreed, setPassengerAgreed] = useState(false);

  // Third-party passenger fields
  const [tpName, setTpName] = useState('');
  const [tpAgeGroup, setTpAgeGroup] = useState('');
  const [tpSpecialNeeds, setTpSpecialNeeds] = useState('');
  const cardRef = useRef<any>(null);
  const cardContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initializeSquare();
    return () => {
      if (cardRef.current) {
        try { cardRef.current.destroy(); } catch {}
      }
    };
  }, []);

  const waitForSquare = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (window.Square) return resolve();

      // Try dynamically loading the script if it hasn't loaded
      const existingScript = document.querySelector('script[src*="squareup.com"]');
      if (!existingScript) {
        const script = document.createElement('script');
        script.src = 'https://web.squarecdn.com/v1/square.js';
        script.onload = () => {
          if (window.Square) resolve();
          else reject(new Error('Square script loaded but SDK not available'));
        };
        script.onerror = () => reject(new Error('Failed to download Square SDK script'));
        document.head.appendChild(script);
        return;
      }

      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if (window.Square) {
          clearInterval(interval);
          resolve();
        } else if (attempts >= 30) {
          clearInterval(interval);
          reject(new Error('Square SDK timed out. Check browser console for blocked scripts.'));
        }
      }, 500);
    });
  };

  const initializeSquare = async () => {
    try {
      await waitForSquare();

      const applicationId = import.meta.env.VITE_SQUARE_APPLICATION_ID;
      const locationId = import.meta.env.VITE_SQUARE_LOCATION_ID;

      if (!applicationId || !locationId) {
        setError('Payment configuration missing. Please contact support.');
        return;
      }

      const payments = window.Square.payments(applicationId, locationId);
      const card = await payments.card();
      await card.attach(cardContainerRef.current);
      cardRef.current = card;
      setCardReady(true);
    } catch (err: any) {
      console.error('Square init error:', err);
      setError(`Payment error: ${err.message || err}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardRef.current || processing) return;

    if (bookingForSomeoneElse) {
      if (!tpName.trim()) { setError('Please enter the passenger\'s name'); return; }
      if (!tpAgeGroup) { setError('Please select the passenger\'s age group'); return; }
    }

    setProcessing(true);
    setError(null);

    try {
      const result = await cardRef.current.tokenize();
      if (result.status !== 'OK') {
        throw new Error(result.errors?.[0]?.message || 'Card tokenization failed');
      }

      const sourceId = result.token;

      const thirdPartyPassenger = bookingForSomeoneElse ? {
        name: tpName,
        gender: bookingForGender || 'Unknown',
        age_group: tpAgeGroup,
        special_needs: tpSpecialNeeds || null,
      } : null;

      const response = await fetch(`${API_URL}/api/create-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId,
          amount,
          rideId,
          userId,
          seatsToBook,
          rideName,
          ...(thirdPartyPassenger ? { thirdPartyPassenger } : {}),
        }),
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      onSuccess(data.paymentId);
    } catch (err: any) {
      setError(err.message || 'Payment failed');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
    }}>
      <div style={{
        backgroundColor: 'white', borderRadius: '20px', padding: isMobile ? '20px' : '32px',
        maxWidth: bookingForSomeoneElse && !isMobile ? '820px' : '480px', width: '100%', margin: '16px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1F2937', margin: 0 }}>
            Payment Details
          </h2>
          <button
            type="button"
            onClick={onCancel}
            disabled={processing}
            style={{
              background: 'none', border: 'none', fontSize: '28px', color: '#9CA3AF',
              cursor: processing ? 'not-allowed' : 'pointer', padding: '0 4px', lineHeight: 1,
            }}
            aria-label="Close"
          >
            &times;
          </button>
        </div>
        <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '24px' }}>
          Your card will be charged only when the driver accepts your booking.
        </p>

        <div style={{
          backgroundColor: '#F8FAFB', borderRadius: '12px', padding: '16px', marginBottom: '24px',
          border: '1px solid #E8EBED',
        }}>
          <p style={{ fontSize: '14px', color: '#4B5563', margin: 0 }}>
            <span style={{ fontWeight: '600' }}>{rideName}</span>
          </p>
          <p style={{ fontSize: '14px', color: '#4B5563', margin: '4px 0 0' }}>
            {seatsToBook} seat{seatsToBook !== 1 ? 's' : ''}
          </p>
          <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#1F2937', margin: '8px 0 0' }}>
            £{amount.toFixed(2)}
          </p>
        </div>

        <div style={{
          display: bookingForSomeoneElse && !isMobile ? 'grid' : 'block',
          gridTemplateColumns: '1fr 1fr',
          gap: '24px',
        }}>
          {/* Left column: Third-Party Passenger Details */}
          {bookingForSomeoneElse && (
            <div style={{
              backgroundColor: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: isMobile ? '16px' : 0,
            }}>
              <p style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '700', color: '#1e40af' }}>
                Passenger Details
              </p>
              <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#4B5563' }}>
                You are booking for someone else. Please provide their details so the driver can review.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>Passenger Name *</label>
                  <input
                    type="text"
                    value={tpName}
                    onChange={(e) => setTpName(e.target.value)}
                    placeholder="Full name of the passenger"
                    style={{ width: '100%', padding: '10px 12px', fontSize: '14px', border: '2px solid #E5E7EB', borderRadius: '8px', transition: 'border-color 0.3s', boxSizing: 'border-box' }}
                    onFocus={(e) => e.target.style.borderColor = '#1A9D9D'}
                    onBlur={(e) => e.target.style.borderColor = '#E5E7EB'}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>Gender</label>
                    <input
                      type="text"
                      value={bookingForGender || ''}
                      disabled
                      style={{ width: '100%', padding: '10px 12px', fontSize: '14px', border: '2px solid #E5E7EB', borderRadius: '8px', backgroundColor: '#F3F4F6', color: '#6B7280', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>Age Group *</label>
                    <select
                      value={tpAgeGroup}
                      onChange={(e) => setTpAgeGroup(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', fontSize: '14px', border: '2px solid #E5E7EB', borderRadius: '8px', backgroundColor: 'white', boxSizing: 'border-box' }}
                    >
                      <option value="">Select</option>
                      <option value="12-17">12–17</option>
                      <option value="18-25">18–25</option>
                      <option value="26-40">26–40</option>
                      <option value="41-60">41–60</option>
                      <option value="60+">60+</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>Special Needs / Accessibility</label>
                  <input
                    type="text"
                    value={tpSpecialNeeds}
                    onChange={(e) => setTpSpecialNeeds(e.target.value)}
                    placeholder="e.g. walker, wheelchair (optional)"
                    style={{ width: '100%', padding: '10px 12px', fontSize: '14px', border: '2px solid #E5E7EB', borderRadius: '8px', transition: 'border-color 0.3s', boxSizing: 'border-box' }}
                    onFocus={(e) => e.target.style.borderColor = '#1A9D9D'}
                    onBlur={(e) => e.target.style.borderColor = '#E5E7EB'}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Right column (or full width when not booking for someone else): Declaration + Card + Buttons */}
          <div>
            {/* Passenger Responsibility Declaration */}
            <div style={{
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '12px',
              padding: '14px',
              marginBottom: '16px',
              fontSize: '12px',
              lineHeight: '1.5',
              color: '#374151',
            }}>
              <p style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: '700', color: '#166534' }}>
                Passenger Responsibility
              </p>
              <p style={{ margin: '0 0 10px 0' }}>
                By booking this ride, I agree to arrive at the pick-up point on time, pay my share of costs as agreed, behave respectfully, and understand that ChapaRide is only a platform and my safety is my responsibility.
              </p>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={passengerAgreed}
                  onChange={(e) => setPassengerAgreed(e.target.checked)}
                  style={{
                    width: '18px',
                    height: '18px',
                    marginTop: '1px',
                    flexShrink: 0,
                    accentColor: '#1A9D9D',
                    cursor: 'pointer',
                  }}
                />
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>
                  I have read, understood, and agree to the above.
                </span>
              </label>
            </div>

            <form onSubmit={handleSubmit}>
              <div
                ref={cardContainerRef}
                style={{
                  marginBottom: '16px', padding: '12px', border: '2px solid #E8EBED',
                  borderRadius: '12px', minHeight: '50px',
                }}
              />

              {!cardReady && !error && (
                <p style={{ fontSize: '14px', color: '#6B7280', textAlign: 'center', marginBottom: '16px' }}>
                  Loading payment form...
                </p>
              )}

              {error && (
                <div style={{
                  backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '12px',
                  padding: '12px', marginBottom: '16px',
                }}>
                  <p style={{ color: '#991b1b', margin: 0, fontSize: '14px' }}>{error}</p>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={processing}
                  style={{
                    flex: 1, padding: '14px', border: '2px solid #E8EBED', borderRadius: '12px',
                    backgroundColor: 'white', color: '#4B5563', fontSize: '16px', fontWeight: '600',
                    cursor: processing ? 'not-allowed' : 'pointer', opacity: processing ? 0.5 : 1,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processing || !cardReady || !passengerAgreed}
                  style={{
                    flex: 1, padding: '14px', border: 'none', borderRadius: '12px',
                    background: processing || !cardReady || !passengerAgreed ? '#D1D5DB' : 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)',
                    color: 'white', fontSize: '16px', fontWeight: '600',
                    cursor: processing || !cardReady || !passengerAgreed ? 'not-allowed' : 'pointer',
                    boxShadow: processing || !cardReady || !passengerAgreed ? 'none' : '0 4px 12px rgba(26, 157, 157, 0.15)',
                  }}
                >
                  {processing ? 'Processing...' : `Pay £${amount.toFixed(2)}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
