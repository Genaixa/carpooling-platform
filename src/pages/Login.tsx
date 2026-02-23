import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useIsMobile } from '../hooks/useIsMobile';
import type { NavigateFn } from '../lib/types';

interface LoginProps {
  onNavigate: NavigateFn;
}

export default function Login({ onNavigate }: LoginProps) {
  const { signIn } = useAuth();
  const isMobile = useIsMobile();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError('Please enter your email address first, then click Forgot password.');
      return;
    }
    setResetLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      setResetSent(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      const redirect = sessionStorage.getItem('loginRedirect') as import('../lib/types').Page | null;
      sessionStorage.removeItem('loginRedirect');
      onNavigate(redirect || 'home');
    } catch (err: any) {
      setError(err.message || 'Failed to sign in. Please check your credentials.');
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

        <div style={{ maxWidth: '500px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
          {/* Hero Text */}
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h1 style={{
              fontSize: isMobile ? '28px' : '48px',
              fontWeight: 'bold',
              color: 'white',
              marginBottom: '12px',
              textShadow: '2px 2px 4px rgba(0,0,0,0.2)'
            }}>Welcome back</h1>
            <p style={{ fontSize: isMobile ? '16px' : '20px', color: 'rgba(255, 255, 255, 0.95)' }}>
              Sign in to your ChapaRide account
            </p>
          </div>

          {/* Login Card */}
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

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Enter your password"
                    style={{
                      width: '100%',
                      padding: '14px',
                      paddingRight: '50px',
                      fontSize: '16px',
                      border: '2px solid #E8EBED',
                      borderRadius: '12px',
                      backgroundColor: 'white',
                      transition: 'border-color 0.3s'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '14px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '14px',
                      color: '#6B7280',
                      fontWeight: '600',
                      padding: 0,
                    }}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '30px', textAlign: 'right' }}>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={resetLoading}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#1A9D9D',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: resetLoading ? 'not-allowed' : 'pointer',
                    textDecoration: 'underline',
                    padding: 0,
                  }}
                >
                  {resetLoading ? 'Sending...' : 'Forgot password?'}
                </button>
              </div>

              {resetSent && (
                <div style={{
                  backgroundColor: '#dcfce7',
                  border: '1px solid #86efac',
                  borderRadius: '12px',
                  padding: '16px',
                  marginBottom: '20px',
                }}>
                  <p style={{ color: '#166534', margin: 0, fontSize: '14px' }}>
                    Password reset email sent! Check your inbox and follow the link to reset your password.
                  </p>
                </div>
              )}

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
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <div style={{ marginTop: '30px', textAlign: 'center', paddingTop: '25px', borderTop: '1px solid #E8EBED' }}>
              <p style={{ color: '#4B5563', fontSize: '16px', margin: 0 }}>
                Don't have an account?{' '}
                <button
                  onClick={() => onNavigate('register')}
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
                  Register now
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

        input:focus {
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
