import { useEffect } from 'react';
import PaymentModal from '../components/PaymentModal';

interface PaymentPageProps {
  rideId: string;
  amount: number;
  userId: string;
  onSuccess: (paymentIntentId: string) => void;
  onCancel: () => void;
}

export default function PaymentPage({ rideId, amount, userId, onSuccess, onCancel }: PaymentPageProps) {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <PaymentModal
        amount={amount}
        rideId={rideId}
        userId={userId}
        onSuccess={onSuccess}
        onCancel={onCancel}
      />
    </div>
  );
}
