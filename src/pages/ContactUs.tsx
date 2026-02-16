import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { NavigateFn } from '../lib/types';
import { useIsMobile } from '../hooks/useIsMobile';

interface ContactUsProps {
  onNavigate: NavigateFn;
}

export default function ContactUs({ onNavigate }: ContactUsProps) {
  const isMobile = useIsMobile(768);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('General Enquiry');
  const [message, setMessage] = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Message sent! We'll get back to you soon.");
    setName('');
    setEmail('');
    setSubject('General Enquiry');
    setMessage('');
  };

  const inputStyle = (field: string): React.CSSProperties => ({
    width: '100%',
    padding: '12px 16px',
    border: `2px solid ${focusedField === field ? '#1A9D9D' : '#E5E7EB'}`,
    borderRadius: '12px',
    fontSize: '15px',
    outline: 'none',
    transition: 'border-color 0.2s ease',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    backgroundColor: '#fff',
  });

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '6px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#374151',
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#fff',
    borderRadius: '16px',
    padding: isMobile ? '24px' : '32px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F9FAFB' }}>
      {/* Hero Section */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1A9D9D, #8BC34A)',
          padding: isMobile ? '48px 20px' : '64px 20px',
          textAlign: 'center',
        }}
      >
        <h1
          style={{
            color: '#fff',
            fontSize: isMobile ? '32px' : '42px',
            fontWeight: 700,
            margin: '0 0 12px 0',
          }}
        >
          Contact Us
        </h1>
        <p
          style={{
            color: 'rgba(255,255,255,0.9)',
            fontSize: isMobile ? '16px' : '18px',
            margin: 0,
            fontWeight: 400,
          }}
        >
          We'd love to hear from you
        </p>
      </div>

      {/* Content Area */}
      <div
        style={{
          maxWidth: '900px',
          margin: '0 auto',
          padding: isMobile ? '24px 16px 48px' : '40px 20px 64px',
        }}
      >
        {/* Two-column layout */}
        <div
          style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            gap: '24px',
            alignItems: 'flex-start',
          }}
        >
          {/* Left Column - Contact Information */}
          <div
            style={{
              ...cardStyle,
              flex: isMobile ? undefined : '0 0 320px',
              width: isMobile ? '100%' : undefined,
              boxSizing: 'border-box',
            }}
          >
            <h2
              style={{
                fontSize: '20px',
                fontWeight: 700,
                color: '#111827',
                margin: '0 0 24px 0',
              }}
            >
              Contact Information
            </h2>

            {/* Email */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '24px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #1A9D9D, #8BC34A)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="M22 4L12 13L2 4" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                  Email
                </div>
                <a
                  href="mailto:info@chaparide.com"
                  style={{
                    color: '#1A9D9D',
                    textDecoration: 'none',
                    fontSize: '15px',
                    fontWeight: 500,
                  }}
                >
                  info@chaparide.com
                </a>
              </div>
            </div>

            {/* Phone */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '24px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #1A9D9D, #8BC34A)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                  Phone
                </div>
                <div style={{ color: '#9CA3AF', fontSize: '15px', fontStyle: 'italic' }}>
                  Coming soon
                </div>
              </div>
            </div>

            {/* Address */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '24px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #1A9D9D, #8BC34A)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                  Address
                </div>
                <div style={{ color: '#9CA3AF', fontSize: '15px', fontStyle: 'italic' }}>
                  Coming soon
                </div>
              </div>
            </div>

            {/* Business Hours */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #1A9D9D, #8BC34A)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                  Business Hours
                </div>
                <div style={{ color: '#6B7280', fontSize: '15px' }}>
                  Monday - Friday, 9:00 AM - 5:00 PM GMT
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Contact Form */}
          <div
            style={{
              ...cardStyle,
              flex: isMobile ? undefined : 1,
              width: isMobile ? '100%' : undefined,
              boxSizing: 'border-box',
            }}
          >
            <h2
              style={{
                fontSize: '20px',
                fontWeight: 700,
                color: '#111827',
                margin: '0 0 24px 0',
              }}
            >
              Send us a Message
            </h2>

            <form onSubmit={handleSubmit}>
              {/* Name */}
              <div style={{ marginBottom: '18px' }}>
                <label style={labelStyle}>Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onFocus={() => setFocusedField('name')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Your full name"
                  required
                  style={inputStyle('name')}
                />
              </div>

              {/* Email */}
              <div style={{ marginBottom: '18px' }}>
                <label style={labelStyle}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="your@email.com"
                  required
                  style={inputStyle('email')}
                />
              </div>

              {/* Subject */}
              <div style={{ marginBottom: '18px' }}>
                <label style={labelStyle}>Subject</label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  onFocus={() => setFocusedField('subject')}
                  onBlur={() => setFocusedField(null)}
                  required
                  style={{
                    ...inputStyle('subject'),
                    appearance: 'none',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236B7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 16px center',
                    paddingRight: '40px',
                    cursor: 'pointer',
                  }}
                >
                  <option value="General Enquiry">General Enquiry</option>
                  <option value="Driver Application Query">Driver Application Query</option>
                  <option value="Booking Issue">Booking Issue</option>
                  <option value="Payment Issue">Payment Issue</option>
                  <option value="Report a Problem">Report a Problem</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Message */}
              <div style={{ marginBottom: '24px' }}>
                <label style={labelStyle}>Message</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onFocus={() => setFocusedField('message')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="How can we help you?"
                  required
                  rows={5}
                  style={{
                    ...inputStyle('message'),
                    resize: 'vertical',
                    minHeight: '120px',
                  }}
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                style={{
                  width: '100%',
                  padding: '14px 24px',
                  background: 'linear-gradient(135deg, #1A9D9D, #8BC34A)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'opacity 0.2s ease, transform 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLButtonElement).style.opacity = '0.9';
                  (e.target as HTMLButtonElement).style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLButtonElement).style.opacity = '1';
                  (e.target as HTMLButtonElement).style.transform = 'translateY(0)';
                }}
              >
                Send Message
              </button>
            </form>
          </div>
        </div>

        {/* Note below columns */}
        <div
          style={{
            textAlign: 'center',
            marginTop: '32px',
            padding: '16px 20px',
            backgroundColor: '#fff',
            borderRadius: '12px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
          }}
        >
          <p style={{ margin: 0, fontSize: '14px', color: '#6B7280' }}>
            For urgent matters, please email us directly at{' '}
            <a
              href="mailto:info@chaparide.com"
              style={{ color: '#1A9D9D', textDecoration: 'none', fontWeight: 600 }}
            >
              info@chaparide.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
