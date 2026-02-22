import React, { useState } from 'react';

interface AvatarProps {
  photoUrl: string | null | undefined;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function Avatar({ photoUrl, name, size = 'md', className = '' }: AvatarProps) {
  const [imageError, setImageError] = useState(false);

  const sizePx = { sm: 32, md: 40, lg: 64 };
  const fontSize = { sm: '11px', md: '13px', lg: '18px' };
  const px = sizePx[size];

  const getInitials = (name: string): string => {
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const baseStyle: React.CSSProperties = {
    width: px, height: px, borderRadius: '50%',
    flexShrink: 0, display: 'inline-flex', overflow: 'hidden',
  };

  if (!photoUrl || imageError) {
    return (
      <div
        className={className}
        style={{ ...baseStyle, backgroundColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center', color: '#4B5563', fontWeight: 600, fontSize: fontSize[size] }}
      >
        {getInitials(name)}
      </div>
    );
  }

  return (
    <div className={className} style={baseStyle}>
      <img
        src={photoUrl}
        alt={name}
        style={{ objectFit: 'cover', objectPosition: 'center', width: '100%', height: '100%', display: 'block' }}
        onError={() => setImageError(true)}
      />
    </div>
  );
}
