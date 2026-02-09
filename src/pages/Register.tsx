import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import type { NavigateFn } from '../lib/types';

interface RegisterProps {
  onNavigate: NavigateFn;
}

export default function Register({ onNavigate }: RegisterProps) {
  const { signUp } = useAuth();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    travelStatus: 'solo-male' as 'solo-male' | 'solo-female' | 'couple',
    partnerName: ''
  });
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
  
    if (formData.travelStatus === 'couple' && !formData.partnerName.trim()) {
      setError('Partner name is required for couples');
      return;
    }
  
    setLoading(true);
  
    try {
      // Determine gender from travel status
      let gender: 'Male' | 'Female' | 'Prefer not to say' = 'Prefer not to say';
      if (formData.travelStatus === 'solo-male') {
        gender = 'Male';
      } else if (formData.travelStatus === 'solo-female') {
        gender = 'Female';
      }
  
      // Determine travel_status
      const travel_status = formData.travelStatus === 'couple' ? 'couple' : 'solo';
  
      await signUp(
        formData.email,
        formData.password,
        {
          name: formData.fullName,
          phone: formData.phone,
          gender: gender,
          travel_status: travel_status,
          partner_name: formData.partnerName
        }
      );
      onNavigate('home');
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFB' }}>
      {/* Navigation - Centered Menu */}
      <nav style={{ backgroundColor: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '90px', gap: '60px', position: 'relative' }}>
            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => onNavigate('home')}>
              <img 
                src="/ChapaRideLogo.jpg" 
                alt="ChapaRide Logo" 
                style={{ 
                  height: '75px', 
                  width: 'auto',
                  objectFit: 'contain'
                }} 
              />
            </div>
            
            {/* Centered Menu Items */}
            <div style={{ display: 'flex', gap: '30px', alignItems: 'center' }}>
              <button onClick={() => onNavigate('home')} style={{ background: 'none', border: 'none', color: '#4B5563', fontSize: '16px', cursor: 'pointer', fontWeight: '500', transition: 'color 0.3s' }}>Find a Ride</button>
              <button onClick={() => onNavigate('post-ride')} style={{ background: 'none', border: 'none', color: '#4B5563', fontSize: '16px', cursor: 'pointer', fontWeight: '500', transition: 'color 0.3s' }}>Post a Ride</button>
            </div>

            {/* Sign In Button - Absolute Right */}
            <div style={{ position: 'absolute', right: '20px' }}>
              <button onClick={() => onNavigate('login')} style={{ 
                padding: '12px 28px', 
                background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)', 
                color: 'white', 
                borderRadius: '25px', 
                fontSize: '16px', 
                fontWeight: 'bold', 
                border: 'none', 
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(26, 157, 157, 0.15)',
                transition: 'transform 0.3s'
              }}>Sign In</button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section with Form */}
      <section style={{ 
        background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)', 
        padding: '60px 20px 100px',
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
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h1 style={{ 
              fontSize: '48px', 
              fontWeight: 'bold', 
              color: 'white', 
              marginBottom: '15px',
              textShadow: '2px 2px 4px rgba(0,0,0,0.2)'
            }}>Create your account</h1>
            <p style={{ fontSize: '20px', color: 'rgba(255, 255, 255, 0.95)' }}>
              Join thousands of travellers saving money on rides
            </p>
          </div>

          {/* Register Card */}
          <div style={{ 
            backgroundColor: 'white', 
            borderRadius: '24px', 
            padding: '40px', 
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

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>Full Name *</label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  required
                  placeholder="John Smith"
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
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>Travel Status *</label>
                <select
                  name="travelStatus"
                  value={formData.travelStatus}
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
                  <option value="solo-male">Solo Male</option>
                  <option value="solo-female">Solo Female</option>
                  <option value="couple">Couple</option>
                </select>
              </div>

              {formData.travelStatus === 'couple' && (
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>Partner Name *</label>
                  <input
                    type="text"
                    name="partnerName"
                    value={formData.partnerName}
                    onChange={handleChange}
                    required={formData.travelStatus === 'couple'}
                    placeholder="Partner's name"
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
              )}

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

              <div style={{ marginBottom: '30px' }}>
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
                {loading ? 'Creating account...' : 'Create Account'}
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
