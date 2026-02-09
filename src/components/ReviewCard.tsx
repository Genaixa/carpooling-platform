import React from 'react';
import { Review } from '../lib/supabase';
import StarRating from './StarRating';
import Avatar from './Avatar';

export interface ReviewCardProps {
  review: Review;
  onViewProfile?: (userId: string) => void;
}

export default function ReviewCard({ review, onViewProfile }: ReviewCardProps) {
  const reviewer = review.reviewer;
  const dateStr = new Date(review.created_at).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div style={{
      padding: '16px',
      border: '1px solid #E8EBED',
      borderRadius: '12px',
      backgroundColor: '#F8FAFB',
      marginBottom: '12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
        {reviewer && (
          <Avatar
            photoUrl={reviewer.profile_photo_url}
            name={reviewer.name}
            size="sm"
          />
        )}
        <div style={{ flex: 1 }}>
          <p
            style={{ fontSize: '14px', fontWeight: '600', color: onViewProfile && reviewer ? '#1A9D9D' : '#1F2937', margin: 0, cursor: onViewProfile && reviewer ? 'pointer' : 'default' }}
            onClick={() => onViewProfile && reviewer && onViewProfile(reviewer.id)}
          >
            {reviewer?.name || 'Anonymous'}
          </p>
          <p style={{ fontSize: '12px', color: '#6B7280', margin: 0 }}>{dateStr}</p>
        </div>
        <StarRating rating={review.rating} size="sm" />
      </div>
      {review.comment && (
        <p style={{ fontSize: '14px', color: '#4B5563', margin: 0, marginTop: '8px' }}>
          {review.comment}
        </p>
      )}
    </div>
  );
}
