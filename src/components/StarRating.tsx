import React from 'react';

interface StarRatingProps {
  rating: number;
  maxStars?: number;
  interactive?: boolean;
  onChange?: (rating: number) => void;
  size?: 'sm' | 'md' | 'lg';
}

export default function StarRating({ rating, maxStars = 5, interactive = false, onChange, size = 'md' }: StarRatingProps) {
  const sizeMap = { sm: '16px', md: '20px', lg: '24px' };
  const starSize = sizeMap[size];

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
      {Array.from({ length: maxStars }, (_, i) => {
        const starValue = i + 1;
        const filled = starValue <= Math.round(rating);
        return (
          <svg
            key={i}
            onClick={() => interactive && onChange?.(starValue)}
            style={{
              width: starSize,
              height: starSize,
              color: filled ? '#f59e0b' : '#d1d5db',
              cursor: interactive ? 'pointer' : 'default',
              transition: 'color 0.2s',
            }}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        );
      })}
    </div>
  );
}
