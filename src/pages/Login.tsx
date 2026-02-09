import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import type { NavigateFn } from '../lib/types';

interface LoginProps {
  onNavigate: NavigateFn;
}

export default function Login({ onNavigate }: LoginProps) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      onNavigate('home');
    } catch (err: any) {
      setError(err.message || 'Failed to sign in. Please check your credentials.');
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

            {/* Register Button - Absolute Right */}
            <div style={{ position: 'absolute', right: '20px' }}>
              <button onClick={() => onNavigate('register')} style={{ 
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
              }}>Register</button>
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

        <div style={{ maxWidth: '500px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
          {/* Hero Text */}
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h1 style={{ 
              fontSize: '48px', 
              fontWeight: 'bold', 
              color: 'white', 
              marginBottom: '15px',
              textShadow: '2px 2px 4px rgba(0,0,0,0.2)'
            }}>Welcome back</h1>
            <p style={{ fontSize: '20px', color: 'rgba(255, 255, 255, 0.95)' }}>
              Sign in to your ChapaRide account
            </p>
          </div>

          {/* Login Card */}
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

              <div style={{ marginBottom: '30px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter your password"
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
