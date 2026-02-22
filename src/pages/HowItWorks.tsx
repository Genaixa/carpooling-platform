import { useIsMobile } from '../hooks/useIsMobile';
import type { NavigateFn } from '../lib/types';

interface HowItWorksProps {
  onNavigate: NavigateFn;
}

export default function HowItWorks({ onNavigate }: HowItWorksProps) {
  const isMobile = useIsMobile();

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFB' }}>
      {/* Hero */}
      <section style={{
        background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)',
        color: 'white',
        padding: isMobile ? '40px 16px' : '64px 20px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.1 }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)', backgroundSize: '40px 40px' }} />
        </div>
        <div style={{ position: 'relative', zIndex: 10 }}>
          <h1 style={{ fontSize: isMobile ? '28px' : '42px', fontWeight: 'bold', marginBottom: '12px', color: 'white' }}>
            How It Works
          </h1>
          <p style={{ fontSize: isMobile ? '15px' : '18px', color: 'rgba(255,255,255,0.9)', maxWidth: '600px', margin: '0 auto' }}>
            Whether you're offering a ride or looking for one, ChapaRide makes it simple, safe, and affordable.
          </p>
        </div>
      </section>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: isMobile ? '40px 16px 64px' : '56px 20px 80px' }}>

        {/* For Passengers */}
        <div style={{ marginBottom: '56px' }}>
          <h2 style={{
            fontSize: isMobile ? '22px' : '28px', fontWeight: 'bold', color: '#1A9D9D', marginBottom: '24px',
            display: 'flex', alignItems: 'center', gap: '12px'
          }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: '40px', height: '40px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)',
              color: 'white', flexShrink: 0
            }}>
              <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </span>
            For Passengers
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '20px' }}>
            {[
              { step: '1', title: 'Create Your Account', desc: 'Sign up with your email. Complete your profile with your gender and travel status (solo or couple) — this helps us match you with compatible rides.' },
              { step: '2', title: 'Find a Ride', desc: 'Search by departure, destination, date, and number of passengers. Filter by price, driver type, and more. Incompatible rides are greyed out so you only book what works for you.' },
              { step: '3', title: 'Book & Pay Securely', desc: 'Select how many seats you need and pay securely with your card. Your payment is held until the driver accepts your booking — if they don\'t, your card hold is automatically released.' },
              { step: '4', title: 'Travel & Review', desc: 'Once the driver confirms, you\'ll see their contact details 24 hours before departure. After the journey, leave a review to help the community.' },
            ].map((item) => (
              <div key={item.step} style={{
                padding: '24px', borderRadius: '16px', border: '1px solid #E8EBED',
                backgroundColor: 'white', position: 'relative',
                boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
              }}>
                <div style={{
                  position: 'absolute', top: '-14px', left: '24px',
                  width: '32px', height: '32px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)',
                  color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '15px', fontWeight: 'bold',
                  boxShadow: '0 2px 8px rgba(26,157,157,0.3)',
                }}>{item.step}</div>
                <h3 style={{ fontSize: '17px', fontWeight: '700', color: '#1F2937', marginBottom: '8px', marginTop: '6px' }}>{item.title}</h3>
                <p style={{ fontSize: '14px', color: '#4B5563', lineHeight: '1.7', margin: 0 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* For Drivers */}
        <div style={{ marginBottom: '56px' }}>
          <h2 style={{
            fontSize: isMobile ? '22px' : '28px', fontWeight: 'bold', color: '#1A9D9D', marginBottom: '24px',
            display: 'flex', alignItems: 'center', gap: '12px'
          }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: '40px', height: '40px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)',
              color: 'white', flexShrink: 0
            }}>
              <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </span>
            For Drivers
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '20px' }}>
            {[
              { step: '1', title: 'Apply to Drive', desc: 'Complete your profile, submit a driver application and bank details for payouts. By applying, you confirm that you hold a valid driving licence, appropriate insurance, and that your vehicle is roadworthy and legally compliant.' },
              { step: '2', title: 'Post a Ride', desc: 'Once approved, post your journey with departure, destination, date, time, price per seat, available seats, and luggage capacity. You set up the amount towards your travel costs.' },
              { step: '3', title: 'Manage Bookings', desc: 'When a passenger books, you\'ll receive a notification. Accept or decline the booking from your dashboard. Accepted bookings capture the passenger\'s payment.' },
              { step: '4', title: 'Complete & Get Paid', desc: 'After the journey, mark the ride as complete in your dashboard. The platform takes a 25% fee and the remaining 75% is paid out to your bank account. You will get paid within 3–5 working days.' },
            ].map((item) => (
              <div key={item.step} style={{
                padding: '24px', borderRadius: '16px', border: '1px solid #E8EBED',
                backgroundColor: 'white', position: 'relative',
                boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
              }}>
                <div style={{
                  position: 'absolute', top: '-14px', left: '24px',
                  width: '32px', height: '32px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)',
                  color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '15px', fontWeight: 'bold',
                  boxShadow: '0 2px 8px rgba(26,157,157,0.3)',
                }}>{item.step}</div>
                <h3 style={{ fontSize: '17px', fontWeight: '700', color: '#1F2937', marginBottom: '8px', marginTop: '6px' }}>{item.title}</h3>
                <p style={{ fontSize: '14px', color: '#4B5563', lineHeight: '1.7', margin: 0 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Ride Alerts */}
        <div style={{ marginBottom: '56px' }}>
          <h2 style={{
            fontSize: isMobile ? '22px' : '28px', fontWeight: 'bold', color: '#1A9D9D', marginBottom: '24px',
            display: 'flex', alignItems: 'center', gap: '12px'
          }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: '40px', height: '40px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)',
              color: 'white', flexShrink: 0
            }}>
              <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </span>
            Ride Alerts
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '20px' }}>
            {[
              { step: '1', title: 'Set Up an Alert', desc: 'Can\'t find a ride that suits you? Go to Ride Alerts and tell us your departure, destination, date, preferred time, and number of passengers.' },
              { step: '2', title: 'Get Notified by Email', desc: 'When a driver posts a ride that matches your alert, we\'ll send you an email straightaway so you can book it before seats fill up.' },
              { step: '3', title: 'Manage Your Alerts', desc: 'View all your active alerts on the Ride Alerts page. Remove any you no longer need. Past-date alerts are automatically marked as expired.' },
              { step: '4', title: 'Ride Alerts', desc: 'Are you travelling? Why not check if anyone wants a ride and share the cost.' },
            ].map((item) => (
              <div key={item.step} style={{
                padding: '24px', borderRadius: '16px', border: '1px solid #E8EBED',
                backgroundColor: 'white', position: 'relative',
                boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
              }}>
                <div style={{
                  position: 'absolute', top: '-14px', left: '24px',
                  width: '32px', height: '32px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)',
                  color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '15px', fontWeight: 'bold',
                  boxShadow: '0 2px 8px rgba(26,157,157,0.3)',
                }}>{item.step}</div>
                <h3 style={{ fontSize: '17px', fontWeight: '700', color: '#1F2937', marginBottom: '8px', marginTop: '6px' }}>{item.title}</h3>
                <p style={{ fontSize: '14px', color: '#4B5563', lineHeight: '1.7', margin: 0 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Safety & Policies */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(26,157,157,0.06) 0%, rgba(139,195,74,0.06) 100%)',
          borderRadius: '20px', padding: isMobile ? '28px 20px' : '40px',
          border: '1px solid rgba(26,157,157,0.15)',
          marginBottom: '48px',
        }}>
          <h2 style={{ fontSize: isMobile ? '22px' : '28px', fontWeight: 'bold', color: '#1F2937', marginBottom: '28px', textAlign: 'center' }}>
            Safety & Policies
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '24px' }}>
            <div>
              <h4 style={{ fontSize: '15px', fontWeight: '700', color: '#1A9D9D', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg style={{ width: '16px', height: '16px', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Approved Drivers
              </h4>
              <p style={{ fontSize: '14px', color: '#4B5563', lineHeight: '1.7', margin: '0 0 20px' }}>
                Every driver is reviewed and approved before they can offer rides. Drivers are responsible for holding a valid driving licence, appropriate insurance, and ensuring their vehicle is roadworthy and legally compliant.
              </p>

              <h4 style={{ fontSize: '15px', fontWeight: '700', color: '#1A9D9D', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg style={{ width: '16px', height: '16px', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Compatibility Matching
              </h4>
              <p style={{ fontSize: '14px', color: '#4B5563', lineHeight: '1.7', margin: '0 0 20px' }}>
                Our system matches passengers and drivers based on gender and travel status (solo/couple) for a comfortable journey. Incompatible rides are visible but cannot be booked.
              </p>

              <h4 style={{ fontSize: '15px', fontWeight: '700', color: '#1A9D9D', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg style={{ width: '16px', height: '16px', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Contact Privacy
              </h4>
              <p style={{ fontSize: '14px', color: '#4B5563', lineHeight: '1.7', margin: 0 }}>
                Phone numbers and contact details are only shared between driver and passenger 24 hours before the ride's departure time — not before.
              </p>
            </div>

            <div>
              <h4 style={{ fontSize: '15px', fontWeight: '700', color: '#1A9D9D', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg style={{ width: '16px', height: '16px', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                Secure Payments
              </h4>
              <p style={{ fontSize: '14px', color: '#4B5563', lineHeight: '1.7', margin: '0 0 20px' }}>
                All payments are processed securely through Square. Your card is authorised when you book but only charged once the driver accepts. If declined, the hold is released automatically.
              </p>

              <h4 style={{ fontSize: '15px', fontWeight: '700', color: '#1A9D9D', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg style={{ width: '16px', height: '16px', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Cancellation Policy
              </h4>
              <p style={{ fontSize: '14px', color: '#4B5563', lineHeight: '1.7', margin: '0 0 20px' }}>
                <strong>Passengers:</strong> Cancel more than 48 hours before departure for a 75% refund. Cancellations within 48 hours are non-refundable.<br />
                <strong>Drivers:</strong> If a driver cancels a ride, all passengers receive a full 100% refund.
              </p>

              <h4 style={{ fontSize: '15px', fontWeight: '700', color: '#1A9D9D', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg style={{ width: '16px', height: '16px', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
                Reviews & Ratings
              </h4>
              <p style={{ fontSize: '14px', color: '#4B5563', lineHeight: '1.7', margin: 0 }}>
                After each completed journey, both drivers and passengers can leave reviews for each other. Ratings are displayed on public profiles to help the community make informed choices.
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '16px', color: '#6B7280', marginBottom: '20px' }}>Ready to get started?</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <button
              onClick={() => onNavigate('home')}
              style={{
                padding: '14px 32px',
                background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)',
                color: 'white', borderRadius: '50px', fontSize: '16px', fontWeight: '700',
                border: 'none', cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(26,157,157,0.3)',
              }}
            >
              Find a Ride
            </button>
            <button
              onClick={() => onNavigate('register')}
              style={{
                padding: '14px 32px',
                background: 'none',
                color: '#1A9D9D', borderRadius: '50px', fontSize: '16px', fontWeight: '700',
                border: '2px solid #1A9D9D', cursor: 'pointer',
              }}
            >
              Sign Up
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
