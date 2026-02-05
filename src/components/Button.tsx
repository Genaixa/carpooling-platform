import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'link' | 'warning'; // ← CHANGED: Added 'warning'
  children: React.ReactNode;
}

export default function Button({
  variant = 'primary',
  children,
  className = '',
  ...props
}: ButtonProps) {
  const baseStyles = 'px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

  const variantStyles = {
    primary: 'bg-[#10bd59] text-white hover:bg-[#0c8e43] rounded-[30px]',
    secondary: 'bg-[#e2e2e2] text-[#12354c] hover:bg-[#d3d3d3]',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    link: 'bg-transparent text-[#4198d0] hover:text-[#005a9e] hover:underline border-none shadow-none p-0',
    warning: 'bg-yellow-500 text-white hover:bg-yellow-600', // ← ADDED: This line
  };

  return (
    <button
      className={`${variant === 'link' ? '' : baseStyles} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}