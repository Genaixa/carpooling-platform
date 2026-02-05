import React, { useState } from 'react';

interface AvatarProps {
  photoUrl: string | null | undefined;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function Avatar({ photoUrl, name, size = 'md', className = '' }: AvatarProps) {
  const [imageError, setImageError] = useState(false);
  
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-16 h-16 text-lg',
  };

  const getInitials = (name: string): string => {
    const parts = name.trim().split(' ');
    if (parts.length === 1) {
      return parts[0].charAt(0).toUpperCase();
    }
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  // Show default avatar if no photo URL or image failed to load
  if (!photoUrl || imageError) {
    return (
      <div
        className={`${sizeClasses[size]} rounded-full bg-gray-300 flex items-center justify-center text-gray-600 font-medium ${className}`}
      >
        {getInitials(name)}
      </div>
    );
  }

  return (
    <div 
      className={`${sizeClasses[size]} rounded-full overflow-hidden flex-shrink-0 ${className}`}
      style={{ 
        display: 'inline-block',
        position: 'relative'
      }}
    >
      <img
        src={photoUrl}
        alt={name}
        className="object-cover"
        style={{ 
          objectFit: 'cover', 
          objectPosition: 'center',
          width: '100%',
          height: '100%',
          display: 'block'
        }}
        onError={() => setImageError(true)}
      />
    </div>
  );
}
