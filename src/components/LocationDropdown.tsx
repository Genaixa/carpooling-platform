import React, { useState, useRef, useEffect } from 'react';
import { ROUTE_LOCATIONS, ROUTE_LOCATIONS_CITIES, ROUTE_LOCATIONS_AIRPORTS } from '../lib/constants';

interface LocationDropdownProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  required?: boolean;
  error?: string;
  placeholder?: string;
  exclude?: string;
}

const groups = [
  { label: 'Cities', locations: ROUTE_LOCATIONS_CITIES as readonly string[] },
  { label: 'Airports', locations: ROUTE_LOCATIONS_AIRPORTS as readonly string[] },
];

export default function LocationDropdown({ value, onChange, label, required, error, placeholder, exclude }: LocationDropdownProps) {
  const isOther = value !== '' && !ROUTE_LOCATIONS.includes(value as any);
  const [open, setOpen] = useState(false);
  const [showOther, setShowOther] = useState(isOther);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const displayValue = showOther ? 'Other (type your own)' : value || placeholder || 'Select location';
  const isPlaceholder = !value && !showOther;

  const handleSelect = (loc: string) => {
    setShowOther(false);
    onChange(loc);
    setOpen(false);
  };

  const handleOther = () => {
    setShowOther(true);
    onChange('');
    setOpen(false);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>
        {label} {required && '*'}
      </label>

      {/* Trigger button */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          padding: '14px',
          paddingRight: '40px',
          fontSize: '16px',
          border: error ? '2px solid #ef4444' : '2px solid #E8EBED',
          borderRadius: '12px',
          backgroundColor: 'white',
          color: isPlaceholder ? '#9CA3AF' : '#111827',
          cursor: 'pointer',
          boxSizing: 'border-box',
          position: 'relative',
          userSelect: 'none',
          lineHeight: '1.4',
          minHeight: '52px',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <span style={{ flex: 1, wordBreak: 'break-word' }}>{displayValue}</span>
        <span style={{
          position: 'absolute', right: '14px', top: '50%', transform: `translateY(-50%) rotate(${open ? '180deg' : '0deg'})`,
          transition: 'transform 0.2s', fontSize: '12px', color: '#6B7280',
        }}>▼</span>
      </div>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          backgroundColor: 'white', border: '2px solid #E8EBED', borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 1000,
          maxHeight: '280px', overflowY: 'auto',
        }}>
          {/* Placeholder option */}
          <div
            onClick={() => { onChange(''); setShowOther(false); setOpen(false); }}
            style={{
              padding: '12px 14px', fontSize: '15px', color: '#9CA3AF',
              cursor: 'pointer', borderBottom: '1px solid #F3F4F6',
            }}
          >
            {placeholder || 'Select location'}
          </div>

          {groups.map(group => {
            const filtered = group.locations.filter(loc => !exclude || loc !== exclude);
            if (filtered.length === 0) return null;
            return (
              <div key={group.label}>
                {/* Group header */}
                <div style={{
                  padding: '8px 14px 4px', fontSize: '13px', fontWeight: '700',
                  color: '#111827', textTransform: 'uppercase', letterSpacing: '0.05em',
                  backgroundColor: '#F9FAFB',
                }}>
                  {group.label}
                </div>
                {filtered.map(loc => (
                  <div
                    key={loc}
                    onClick={() => handleSelect(loc)}
                    style={{
                      padding: '11px 14px 11px 20px',
                      fontSize: '15px',
                      color: value === loc ? '#111827' : '#374151',
                      fontWeight: value === loc ? '600' : '400',
                      backgroundColor: value === loc ? '#FEF9E0' : 'white',
                      cursor: 'pointer',
                      borderBottom: '1px solid #F9FAFB',
                      lineHeight: '1.4',
                    }}
                    onMouseEnter={e => { if (value !== loc) (e.currentTarget as HTMLDivElement).style.backgroundColor = '#F9FAFB'; }}
                    onMouseLeave={e => { if (value !== loc) (e.currentTarget as HTMLDivElement).style.backgroundColor = 'white'; }}
                  >
                    {loc}
                  </div>
                ))}
              </div>
            );
          })}

          {/* Other group */}
          <div>
            <div style={{
              padding: '8px 14px 4px', fontSize: '13px', fontWeight: '700',
              color: '#111827', textTransform: 'uppercase', letterSpacing: '0.05em',
              backgroundColor: '#F9FAFB',
            }}>
              Other
            </div>
            <div
              onClick={handleOther}
              style={{
                padding: '11px 14px 11px 20px', fontSize: '15px',
                color: showOther ? '#111827' : '#374151',
                fontWeight: showOther ? '600' : '400',
                backgroundColor: showOther ? '#FEF9E0' : 'white',
                cursor: 'pointer', lineHeight: '1.4',
              }}
              onMouseEnter={e => { if (!showOther) (e.currentTarget as HTMLDivElement).style.backgroundColor = '#F9FAFB'; }}
              onMouseLeave={e => { if (!showOther) (e.currentTarget as HTMLDivElement).style.backgroundColor = 'white'; }}
            >
              Other (type your own)
            </div>
          </div>
        </div>
      )}

      {/* Free-text input for "Other" */}
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
            marginTop: '8px',
            boxSizing: 'border-box',
          }}
        />
      )}

      {error && (
        <p style={{ color: '#ef4444', fontSize: '14px', marginTop: '4px' }}>{error}</p>
      )}
    </div>
  );
}
