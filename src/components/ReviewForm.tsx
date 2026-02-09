import React, { useState } from 'react';
import StarRating from './StarRating';
import toast from 'react-hot-toast';

interface ReviewFormProps {
  onSubmit: (rating: number, comment: string) => Promise<void>;
  onCancel: () => void;
}

export default function ReviewForm({ onSubmit, onCancel }: ReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      toast.error('Please select a rating');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(rating, comment);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{
      padding: '20px',
      backgroundColor: '#F8FAFB',
      borderRadius: '12px',
      border: '1px solid #E8EBED',
    }}>
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>
          Rating *
        </label>
        <StarRating rating={rating} interactive onChange={setRating} size="lg" />
      </div>
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>
          Comment (optional)
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Share your experience..."
          rows={3}
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '14px',
            border: '2px solid #E8EBED',
            borderRadius: '12px',
            resize: 'vertical',
          }}
        />
      </div>
      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          type="submit"
          disabled={submitting || rating === 0}
          style={{
            flex: 1,
            padding: '12px',
            background: submitting || rating === 0 ? '#D1D5DB' : 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: submitting || rating === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? 'Submitting...' : 'Submit Review'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: '12px 20px',
            backgroundColor: '#F5F5F5',
            color: '#4B5563',
            border: 'none',
            borderRadius: '10px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
