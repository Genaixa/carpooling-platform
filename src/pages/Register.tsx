import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useIsMobile } from '../hooks/useIsMobile';
import type { NavigateFn } from '../lib/types';

interface RegisterProps {
  onNavigate: NavigateFn;
  intent?: 'passenger' | 'driver';
}

export default function Register({ onNavigate, intent }: RegisterProps) {
  const { signUp } = useAuth();
  const isMobile = useIsMobile();
  const [formData, setFormData] = useState({
    firstName: '',
    surname: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    postcode: '',
    country: 'United Kingdom',
    gender: 'Male' as 'Male' | 'Female',
    ageGroup: '' as string,
    maritalStatus: '' as string,
  });
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [confirmedAge, setConfirmedAge] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
  
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
  
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (!agreedToTerms) {
      setError('You must agree to the Privacy Policy and Terms of Service');
      return;
    }

    if (!confirmedAge) {
      setError('You must confirm that you are 18 years of age or over');
      return;
    }

    if (!formData.ageGroup) {
      setError('Please select your age group');
      return;
    }

    if (!formData.maritalStatus) {
      setError('Please select your marital status');
      return;
    }
  
    setLoading(true);
  
    try {
      await signUp(
        formData.email,
        formData.password,
        {
          name: `${formData.firstName.trim()} ${formData.surname.trim()}`,
          phone: formData.phone,
          address_line1: formData.addressLine1,
          address_line2: formData.addressLine2,
          city: formData.city,
          postcode: formData.postcode,
          country: formData.country,
          gender: formData.gender,
          age_group: formData.ageGroup,
          marital_status: formData.maritalStatus,
        }
      );
      onNavigate(intent === 'driver' ? 'driver-apply' : 'home');
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFB' }}>
      {/* Hero Section with Form */}
      <section style={{ 
        background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)', 
        padding: isMobile ? '32px 16px 60px' : '60px 20px 100px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Background decorative elements */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255, 255, 255, 0.1) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(255, 255, 255, 0.1) 0%, transparent 50%)',
          pointerEvents: 'none'
        }}></div>

        <div style={{ maxWidth: '600px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
          {/* Hero Text */}
          <div style={{ textAlign: 'center', marginBottom: isMobile ? '24px' : '40px' }}>
            <h1 style={{
              fontSize: isMobile ? '28px' : '48px',
              fontWeight: 'bold',
              color: 'white',
              marginBottom: '12px',
              textShadow: '2px 2px 4px rgba(0,0,0,0.2)'
            }}>{intent === 'driver' ? 'Become a Driver' : 'Create your account'}</h1>
            <p style={{ fontSize: isMobile ? '16px' : '20px', color: 'rgba(255, 255, 255, 0.95)' }}>
              {intent === 'driver'
                ? 'Start saving money by sharing your journeys across the UK'
                : 'Join thousands of travellers saving money on rides'}
            </p>
          </div>

          {/* Step indicator for driver intent */}
          {intent === 'driver' && (
            <div style={{ marginBottom: '24px' }}>
              {/* Step labels */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: 'white' }}>Step 1: Create Account</span>
                <span style={{ fontSize: '13px', fontWeight: '600', color: 'rgba(255,255,255,0.6)' }}>Step 2: Driver Application</span>
              </div>
              {/* Progress bar */}
              <div style={{ backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: '99px', height: '8px' }}>
                <div style={{ width: '50%', backgroundColor: 'white', borderRadius: '99px', height: '8px', transition: 'width 0.3s' }} />
              </div>
            </div>
          )}

          {/* Register Card */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '24px',
            padding: isMobile ? '24px' : '40px', 
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
            animation: 'floatUp 0.7s ease-out'
          }}>
            <form onSubmit={handleSubmit}>
              {error && (
                <div style={{ 
                  backgroundColor: '#fee2e2', 
                  border: '1px solid #fca5a5', 
                  borderRadius: '12px', 
                  padding: '16px', 
                  marginBottom: '25px' 
                }}>
                  <p style={{ color: '#991b1b', margin: 0, fontSize: '16px' }}>{error}</p>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>First Name *</label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    required
                    placeholder="John"
                    style={{ width: '100%', padding: '14px', fontSize: '16px', border: '2px solid #E8EBED', borderRadius: '12px', backgroundColor: 'white', transition: 'border-color 0.3s' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>Surname *</label>
                  <input
                    type="text"
                    name="surname"
                    value={formData.surname}
                    onChange={handleChange}
                    required
                    placeholder="Smith"
                    style={{ width: '100%', padding: '14px', fontSize: '16px', border: '2px solid #E8EBED', borderRadius: '12px', backgroundColor: 'white', transition: 'border-color 0.3s' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>Email Address *</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder="your.email@example.com"
                  style={{ 
                    width: '100%', 
                    padding: '14px', 
                    fontSize: '16px', 
                    border: '2px solid #E8EBED', 
                    borderRadius: '12px', 
                    backgroundColor: 'white',
                    transition: 'border-color 0.3s'
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>Phone Number *</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  placeholder="07123 456789"
                  style={{ 
                    width: '100%', 
                    padding: '14px', 
                    fontSize: '16px', 
                    border: '2px solid #E8EBED', 
                    borderRadius: '12px', 
                    backgroundColor: 'white',
                    transition: 'border-color 0.3s'
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>Address Line 1 *</label>
                <input
                  type="text"
                  name="addressLine1"
                  value={formData.addressLine1}
                  onChange={handleChange}
                  required
                  placeholder="123 High Street"
                  style={{ width: '100%', padding: '14px', fontSize: '16px', border: '2px solid #E8EBED', borderRadius: '12px', backgroundColor: 'white', transition: 'border-color 0.3s' }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>Address Line 2</label>
                <input
                  type="text"
                  name="addressLine2"
                  value={formData.addressLine2}
                  onChange={handleChange}
                  placeholder="Flat 4, Building Name (optional)"
                  style={{ width: '100%', padding: '14px', fontSize: '16px', border: '2px solid #E8EBED', borderRadius: '12px', backgroundColor: 'white', transition: 'border-color 0.3s' }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>City / Town *</label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  required
                  placeholder="London"
                  style={{ width: '100%', padding: '14px', fontSize: '16px', border: '2px solid #E8EBED', borderRadius: '12px', backgroundColor: 'white', transition: 'border-color 0.3s' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>Postcode *</label>
                  <input
                    type="text"
                    name="postcode"
                    value={formData.postcode}
                    onChange={handleChange}
                    required
                    placeholder="SW1A 1AA"
                    style={{ width: '100%', padding: '14px', fontSize: '16px', border: '2px solid #E8EBED', borderRadius: '12px', backgroundColor: 'white', transition: 'border-color 0.3s' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>Country *</label>
                  <input
                    type="text"
                    name="country"
                    value={formData.country}
                    onChange={handleChange}
                    required
                    placeholder="United Kingdom"
                    style={{ width: '100%', padding: '14px', fontSize: '16px', border: '2px solid #E8EBED', borderRadius: '12px', backgroundColor: 'white', transition: 'border-color 0.3s' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>Gender *</label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  required
                  style={{
                    width: '100%',
                    padding: '14px',
                    fontSize: '16px',
                    border: '2px solid #E8EBED',
                    borderRadius: '12px',
                    backgroundColor: 'white',
                    transition: 'border-color 0.3s'
                  }}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>Age Group *</label>
                <select
                  name="ageGroup"
                  value={formData.ageGroup}
                  onChange={handleChange}
                  required
                  style={{
                    width: '100%',
                    padding: '14px',
                    fontSize: '16px',
                    border: '2px solid #E8EBED',
                    borderRadius: '12px',
                    backgroundColor: 'white',
                    transition: 'border-color 0.3s'
                  }}
                >
                  <option value="">Select age group</option>
                  <option value="18-25">18-25</option>
                  <option value="26-35">26-35</option>
                  <option value="36-45">36-45</option>
                  <option value="46-55">46-55</option>
                  <option value="56+">56+</option>
                </select>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>Marital Status *</label>
                <select
                  name="maritalStatus"
                  value={formData.maritalStatus}
                  onChange={handleChange}
                  required
                  style={{
                    width: '100%',
                    padding: '14px',
                    fontSize: '16px',
                    border: '2px solid #E8EBED',
                    borderRadius: '12px',
                    backgroundColor: 'white',
                    transition: 'border-color 0.3s'
                  }}
                >
                  <option value="">Select marital status</option>
                  <option value="Single">Single</option>
                  <option value="Married">Married</option>
                </select>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>Password *</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  placeholder="Minimum 6 characters"
                  style={{ 
                    width: '100%', 
                    padding: '14px', 
                    fontSize: '16px', 
                    border: '2px solid #E8EBED', 
                    borderRadius: '12px', 
                    backgroundColor: 'white',
                    transition: 'border-color 0.3s'
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>Confirm Password *</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  placeholder="Re-enter your password"
                  style={{
                    width: '100%',
                    padding: '14px',
                    fontSize: '16px',
                    border: '2px solid #E8EBED',
                    borderRadius: '12px',
                    backgroundColor: 'white',
                    transition: 'border-color 0.3s'
                  }}
                />
              </div>

              {/* Passenger Responsibility & Children Policy */}
              {intent !== 'driver' && (
                <div style={{
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '12px',
                  padding: '16px',
                  marginBottom: '20px',
                  fontSize: '13px',
                  lineHeight: '1.6',
                  color: '#374151',
                }}>
                  <p style={{ fontWeight: '700', color: '#166534', margin: '0 0 8px 0', fontSize: '14px' }}>
                    Passenger Responsibility
                  </p>
                  <p style={{ margin: '0 0 8px 0' }}>
                    By joining a ride on ChapaRide, I agree to arrive at the pick-up point on time, pay my share of fuel and travel costs as agreed with the driver, behave respectfully and follow the driver's reasonable instructions, and understand that ChapaRide is only a platform and my safety is my responsibility.
                  </p>
                  <p style={{ fontWeight: '700', color: '#166534', margin: '12px 0 8px 0', fontSize: '14px' }}>
                    Children Policy
                  </p>
                  <ul style={{ margin: '0', paddingLeft: '20px' }}>
                    <li>Children under 12 must not travel alone.</li>
                    <li>By registering a passenger aged 12-17, it is implied that parental/guardian consent has been given unless otherwise stated.</li>
                    <li>ChapaRide is a platform only - parents/guardians are responsible for minors' safety.</li>
                  </ul>
                </div>
              )}

              {/* Age Confirmation Checkbox */}
              <div style={{
                backgroundColor: '#f8fafc',
                border: '2px solid #E8EBED',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '16px',
              }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={confirmedAge}
                    onChange={(e) => setConfirmedAge(e.target.checked)}
                    style={{
                      width: '20px',
                      height: '20px',
                      marginTop: '2px',
                      flexShrink: 0,
                      accentColor: '#1A9D9D',
                      cursor: 'pointer',
                    }}
                  />
                  <span style={{ fontSize: '14px', lineHeight: '1.5', color: '#374151' }}>
                    I confirm that I am 18 years of age or over.
                  </span>
                </label>
              </div>

              {/* Legal Agreement Checkbox */}
              <div style={{
                backgroundColor: '#f8fafc',
                border: '2px solid #E8EBED',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '30px',
              }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    style={{
                      width: '20px',
                      height: '20px',
                      marginTop: '2px',
                      flexShrink: 0,
                      accentColor: '#1A9D9D',
                      cursor: 'pointer',
                    }}
                  />
                  <span style={{ fontSize: '14px', lineHeight: '1.5', color: '#374151' }}>
                    I confirm that I have read and agree to ChapaRide's{' '}
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); onNavigate('privacy-policy'); }}
                      style={{ background: 'none', border: 'none', color: '#1A9D9D', fontWeight: '600', cursor: 'pointer', textDecoration: 'underline', padding: 0, fontSize: '14px', fontFamily: 'inherit' }}
                    >
                      Privacy Policy
                    </button>
                    {' '}and{' '}
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); onNavigate('terms'); }}
                      style={{ background: 'none', border: 'none', color: '#1A9D9D', fontWeight: '600', cursor: 'pointer', textDecoration: 'underline', padding: 0, fontSize: '14px', fontFamily: 'inherit' }}
                    >
                      Terms of Service
                    </button>.
                  </span>
                </label>
              </div>


              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '18px',
                  fontSize: '18px',
                  fontWeight: '600',
                  background: loading ? '#D1D5DB' : 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: loading ? 'none' : '0 8px 20px rgba(26, 157, 157, 0.15)',
                  transition: 'all 0.3s'
                }}
              >
                {loading
                  ? 'Creating account...'
                  : intent === 'driver'
                    ? 'Create Account & Continue to Driver Application →'
                    : 'Create Account'}
              </button>
            </form>

            <div style={{ marginTop: '30px', textAlign: 'center', paddingTop: '25px', borderTop: '1px solid #E8EBED' }}>
              <p style={{ color: '#4B5563', fontSize: '16px', margin: 0 }}>
                Already have an account?{' '}
                <button
                  onClick={() => onNavigate('login')}
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    color: '#1A9D9D', 
                    fontSize: '16px', 
                    fontWeight: 'bold', 
                    cursor: 'pointer', 
                    textDecoration: 'underline' 
                  }}
                >
                  Sign in
                </button>
              </p>
            </div>
          </div>
        </div>
      </section>

      <style>{`
        @keyframes floatUp {
          from {
            transform: translateY(40px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        input:focus, select:focus {
          outline: none;
          border-color: #1A9D9D !important;
          box-shadow: 0 0 0 4px rgba(26, 157, 157, 0.1);
        }

        button:hover:not(:disabled) {
          transform: translateY(-2px);
        }
      `}</style>
    </div>
  );
}
