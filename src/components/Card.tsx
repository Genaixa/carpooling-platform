import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export default function Card({ children, className = '', hover = false }: CardProps) {
  const hoverClass = hover ? 'hover:shadow-lg transition-shadow' : '';

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 ${hoverClass} ${className}`}>
      {children}
    </div>
  );
}
