import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = '', ...props }: InputProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-xs font-semibold text-[#12354c] uppercase tracking-wide mb-1.5">
          {label}
        </label>
      )}
      <input
        className={`w-full px-4 py-2.5 border-2 border-gray-300 rounded focus:outline-none focus:border-[#ffc107] focus:bg-[#e2e2e2] text-gray-900 text-sm font-semibold ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: Array<{ value: string; label: string }>;
}

export function Select({ label, error, options, className = '', ...props }: SelectProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-xs font-semibold text-[#12354c] uppercase tracking-wide mb-1.5">
          {label}
        </label>
      )}
      <select
        className={`w-full px-4 py-2.5 border-2 border-gray-300 rounded focus:outline-none focus:border-[#ffc107] focus:bg-[#e2e2e2] text-gray-900 text-sm font-semibold appearance-none bg-white ${className}`}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function TextArea({ label, error, className = '', ...props }: TextAreaProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-xs font-semibold text-[#12354c] uppercase tracking-wide mb-1.5">
          {label}
        </label>
      )}
      <textarea
        className={`w-full px-4 py-2.5 border-2 border-gray-300 rounded focus:outline-none focus:border-[#ffc107] focus:bg-[#e2e2e2] text-gray-900 text-sm font-semibold ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
