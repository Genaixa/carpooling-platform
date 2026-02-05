import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

interface PaymentSuccessProps {
  onNavigate: (page: 'home' | 'my-bookings') => void;
}

export default function PaymentSuccess({ onNavigate }: PaymentSuccessProps) {
  const { user } = useAuth();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const hasVerified = useRef(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const sessionId = urlParams.get('session_id');
    const rideId = urlParams.get('ride_id');

    if (!sessionId || !rideId || !user) {
      setStatus('error');
      setTimeout(() => onNavigate('home'), 3000);
      return;
    }

    // Prevent double-call from React Strict Mode
    if (hasVerified.current) return;
    hasVerified.current = true;

    fetch('http://srv1291941.hstgr.cloud:3001/api/verify-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, rideId, userId: user.id }),
    })
      .then(res => res.json())
      .then(data => {
        console.log('Verification response:', data);
        if (data.success || data.booking) {
            setStatus('success');
            toast.success('Payment successful! Booking confirmed.');
            // Clean up URL to prevent reprocessing on refresh
            window.history.replaceState({}, '', '/#payment-success');
            setTimeout(() => onNavigate('my-bookings'), 2000);
          
        } else {
            setStatus('error');
            toast.error('Payment verification failed');
            window.history.replaceState({}, '', '/#payment-success');
            setTimeout(() => onNavigate('home'), 3000);
          }
          
      })
      .catch(err => {
        console.error('Verification error:', err);
        setStatus('error');
        toast.error('Error verifying payment');
        setTimeout(() => onNavigate('home'), 3000);
      });
  }, [user, onNavigate]);

  return (
    <div className="min-h-screen bg-[#f2f2f2] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
        {status === 'verifying' && (
          <>
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#0075c1] mx-auto mb-4"></div>
            <h2 className="text-2xl font-bold text-[#12354c] mb-2">Processing Payment...</h2>
            <p className="text-[#4d6879]">Please wait while we confirm your booking.</p>
          </>
        )}
        
        {status === 'success' && (
          <>
            <div className="text-[#10bd59] text-6xl mb-4">✓</div>
            <h2 className="text-2xl font-bold text-[#12354c] mb-2">Payment Successful!</h2>
            <p className="text-[#4d6879] mb-4">Your booking has been confirmed.</p>
            <p className="text-sm text-gray-500">Redirecting to your bookings...</p>
          </>
        )}
        
        {status === 'error' && (
          <>
            <div className="text-red-500 text-6xl mb-4">✗</div>
            <h2 className="text-2xl font-bold text-[#12354c] mb-2">Verification Failed</h2>
            <p className="text-[#4d6879] mb-4">We couldn't verify your payment.</p>
            <p className="text-sm text-gray-500">Redirecting to homepage...</p>
          </>
        )}
      </div>
    </div>
  );
}
