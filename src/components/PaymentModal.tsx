import { useState, useEffect, useRef } from 'react';

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
  onSuccess: (paymentId: string) => void;
  onCancel: () => void;
}

export default function PaymentModal({ amount, rideId, userId, seatsToBook, rideName, onSuccess, onCancel }: PaymentModalProps) {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardReady, setCardReady] = useState(false);
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

  const initializeSquare = async () => {
    try {
      if (!window.Square) {
        setError('Square payments SDK not loaded. Please refresh the page.');
        return;
      }

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
      setError('Failed to initialize payment form. Please refresh the page.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardRef.current || processing) return;

    setProcessing(true);
    setError(null);

    try {
      const result = await cardRef.current.tokenize();
      if (result.status !== 'OK') {
        throw new Error(result.errors?.[0]?.message || 'Card tokenization failed');
      }

      const sourceId = result.token;

      const response = await fetch('http://srv1291941.hstgr.cloud:3001/api/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId,
          amount,
          rideId,
          userId,
          seatsToBook,
          rideName,
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
        backgroundColor: 'white', borderRadius: '20px', padding: '32px',
        maxWidth: '480px', width: '100%', margin: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1F2937', marginBottom: '8px' }}>
          Payment Details
        </h2>
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
              disabled={processing || !cardReady}
              style={{
                flex: 1, padding: '14px', border: 'none', borderRadius: '12px',
                background: processing || !cardReady ? '#D1D5DB' : 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)',
                color: 'white', fontSize: '16px', fontWeight: '600',
                cursor: processing || !cardReady ? 'not-allowed' : 'pointer',
                boxShadow: processing || !cardReady ? 'none' : '0 4px 12px rgba(26, 157, 157, 0.15)',
              }}
            >
              {processing ? 'Processing...' : `Pay £${amount.toFixed(2)}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
