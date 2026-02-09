import React, { useState } from 'react';
import { ROUTE_LOCATIONS } from '../lib/constants';

interface LocationDropdownProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  required?: boolean;
  error?: string;
  placeholder?: string;
}

export default function LocationDropdown({ value, onChange, label, required, error, placeholder }: LocationDropdownProps) {
  const isOther = value !== '' && !ROUTE_LOCATIONS.includes(value as any);
  const [showOther, setShowOther] = useState(isOther);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    if (selected === '__other__') {
      setShowOther(true);
      onChange('');
    } else {
      setShowOther(false);
      onChange(selected);
    }
  };

  const selectValue = showOther ? '__other__' : value;

  return (
    <div>
      <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>
        {label} {required && '*'}
      </label>
      <select
        value={selectValue}
        onChange={handleSelectChange}
        style={{
          width: '100%',
          padding: '14px',
          fontSize: '16px',
          border: error ? '2px solid #ef4444' : '2px solid #E8EBED',
          borderRadius: '12px',
          transition: 'border-color 0.3s',
          backgroundColor: 'white',
          color: '#111827',
          appearance: 'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%231F2937' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 16px center',
        }}
      >
        <option value="">{placeholder || 'Select location'}</option>
        {ROUTE_LOCATIONS.map((loc) => (
          <option key={loc} value={loc}>{loc}</option>
        ))}
        <option value="__other__">Other (type your own)</option>
      </select>
      {showOther && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter custom location"
          style={{
            width: '100%',
            padding: '14px',
            fontSize: '16px',
            border: error ? '2px solid #ef4444' : '2px solid #E8EBED',
            borderRadius: '12px',
            transition: 'border-color 0.3s',
            marginTop: '8px',
          }}
        />
      )}
      {error && (
        <p style={{ color: '#ef4444', fontSize: '14px', marginTop: '4px' }}>{error}</p>
      )}
    </div>
  );
}
