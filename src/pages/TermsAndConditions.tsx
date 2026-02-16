import React from 'react';
import { NavigateFn } from '../lib/types';
import { useIsMobile } from '../hooks/useIsMobile';

interface TermsAndConditionsProps {
  onNavigate: NavigateFn;
}

interface SectionProps {
  number: number;
  title: string;
  children: React.ReactNode;
  isMobile: boolean;
}

function Section({ number, title, children, isMobile }: SectionProps) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 12,
        padding: isMobile ? '24px 20px' : '32px 40px',
        marginBottom: 24,
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        border: '1px solid #f0f0f0',
      }}
    >
      <h2
        style={{
          fontSize: isMobile ? 18 : 22,
          fontWeight: 700,
          color: '#1A9D9D',
          marginBottom: 16,
          lineHeight: 1.3,
        }}
      >
        {number}. {title}
      </h2>
      <div
        style={{
          fontSize: isMobile ? 14 : 15,
          lineHeight: 1.75,
          color: '#444',
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default function TermsAndConditions({ onNavigate }: TermsAndConditionsProps) {
  const isMobile = useIsMobile();

  return (
    <div style={{ minHeight: '100vh', background: '#f7f8fa' }}>
      {/* Hero Section */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)',
          padding: isMobile ? '48px 20px 40px' : '72px 40px 56px',
          textAlign: 'center',
        }}
      >
        <h1
          style={{
            fontSize: isMobile ? 28 : 40,
            fontWeight: 800,
            color: '#fff',
            margin: 0,
            marginBottom: 12,
            letterSpacing: '-0.5px',
          }}
        >
          Terms of Service
        </h1>
        <p
          style={{
            fontSize: isMobile ? 14 : 17,
            color: 'rgba(255,255,255,0.9)',
            margin: 0,
            fontWeight: 500,
          }}
        >
          Effective Date: February 2026
        </p>
      </div>

      {/* Content Area */}
      <div
        style={{
          maxWidth: 800,
          margin: '0 auto',
          padding: isMobile ? '32px 16px 48px' : '48px 24px 64px',
        }}
      >
        {/* Preamble */}
        <div
          style={{
            background: '#fff',
            borderRadius: 12,
            padding: isMobile ? '24px 20px' : '32px 40px',
            marginBottom: 32,
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
            border: '1px solid #f0f0f0',
            borderLeft: '4px solid #1A9D9D',
          }}
        >
          <p
            style={{
              fontSize: isMobile ? 14 : 15,
              lineHeight: 1.75,
              color: '#444',
              margin: 0,
            }}
          >
            By using ChapaRide ("we," "our," or "us"), you agree to these Terms of Service. Please
            read them carefully.
          </p>
        </div>

        {/* Section 1: Using ChapaRide */}
        <Section number={1} title="Using ChapaRide" isMobile={isMobile}>
          <ul style={{ margin: '0 0 0 0', paddingLeft: 24 }}>
            <li style={{ marginBottom: 10 }}>
              ChapaRide is a platform to connect drivers and passengers for carpooling.
            </li>
            <li style={{ marginBottom: 10 }}>
              Rides are intended for cost-sharing only, not for profit. Drivers may ask passengers to
              contribute to fuel and travel expenses.
            </li>
            <li style={{ marginBottom: 0 }}>
              You must provide accurate information when creating an account, posting a ride, or
              booking a ride.
            </li>
          </ul>
        </Section>

        {/* Section 2: Account Registration */}
        <Section number={2} title="Account Registration" isMobile={isMobile}>
          <ul style={{ margin: '0 0 0 0', paddingLeft: 24 }}>
            <li style={{ marginBottom: 10 }}>
              You must be at least 18 years old to create an account.
            </li>
            <li style={{ marginBottom: 10 }}>
              You are responsible for maintaining the confidentiality of your account login and
              password.
            </li>
            <li style={{ marginBottom: 0 }}>
              You must provide truthful and complete information. ChapaRide reserves the right to
              verify any details provided.
            </li>
          </ul>
        </Section>

        {/* Section 3: Drivers */}
        <Section number={3} title="Drivers" isMobile={isMobile}>
          <ul style={{ margin: '0 0 0 0', paddingLeft: 24 }}>
            <li style={{ marginBottom: 10 }}>
              Drivers must hold a valid driving licence, have permission to drive the vehicle they
              post, and ensure it has at least third-party insurance, a valid MOT, and current tax.
            </li>
            <li style={{ marginBottom: 10 }}>
              Drivers are responsible for the safety of passengers and must comply with all applicable
              road laws.
            </li>
            <li style={{ marginBottom: 0 }}>
              Contributions from passengers are for cost-sharing only. Any profit from rides is
              prohibited.
            </li>
          </ul>
        </Section>

        {/* Section 4: Passengers */}
        <Section number={4} title="Passengers" isMobile={isMobile}>
          <ul style={{ margin: '0 0 0 0', paddingLeft: 24 }}>
            <li style={{ marginBottom: 10 }}>
              Passengers agree to respect the driver and other passengers.
            </li>
            <li style={{ marginBottom: 10 }}>
              Passengers are responsible for arriving at agreed pick-up points on time.
            </li>
            <li style={{ marginBottom: 0 }}>
              Passengers must not pay more than the suggested cost-sharing amount set by the driver.
            </li>
          </ul>
        </Section>

        {/* Section 5: Safety and Conduct */}
        <Section number={5} title="Safety and Conduct" isMobile={isMobile}>
          <ul style={{ margin: '0 0 0 0', paddingLeft: 24 }}>
            <li style={{ marginBottom: 10 }}>
              All users must behave respectfully and safely.
            </li>
            <li style={{ marginBottom: 0 }}>
              ChapaRide is not responsible for accidents, injuries, or disputes arising from rides.
              Users participate at their own risk.
            </li>
          </ul>
        </Section>

        {/* Section 6: Privacy */}
        <Section number={6} title="Privacy" isMobile={isMobile}>
          <ul style={{ margin: '0 0 0 0', paddingLeft: 24 }}>
            <li style={{ marginBottom: 10 }}>
              Your use of ChapaRide is subject to our{' '}
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate('privacy-policy');
                }}
                style={{ color: '#1A9D9D', textDecoration: 'none', fontWeight: 600 }}
              >
                Privacy Policy
              </a>
              .
            </li>
            <li style={{ marginBottom: 0 }}>
              By using the platform, you consent to ChapaRide collecting and using your information
              as described in the Privacy Policy.
            </li>
          </ul>
        </Section>

        {/* Section 7: Prohibited Activities */}
        <Section number={7} title="Prohibited Activities" isMobile={isMobile}>
          <p style={{ margin: '0 0 12px 0' }}>Users may not:</p>
          <ul style={{ margin: '0 0 0 0', paddingLeft: 24 }}>
            <li style={{ marginBottom: 10 }}>
              Use ChapaRide for commercial transport or profit-making.
            </li>
            <li style={{ marginBottom: 10 }}>
              Provide false, misleading, or fraudulent information.
            </li>
            <li style={{ marginBottom: 0 }}>
              Engage in unlawful, abusive, or harmful behavior.
            </li>
          </ul>
        </Section>

        {/* Section 8: Termination */}
        <Section number={8} title="Termination" isMobile={isMobile}>
          <ul style={{ margin: '0 0 0 0', paddingLeft: 24 }}>
            <li style={{ marginBottom: 10 }}>
              ChapaRide may suspend or terminate accounts at our discretion for violations of these
              Terms of Service.
            </li>
            <li style={{ marginBottom: 0 }}>
              You may also close your account at any time.
            </li>
          </ul>
        </Section>

        {/* Section 9: Limitation of Liability */}
        <Section number={9} title="Limitation of Liability" isMobile={isMobile}>
          <ul style={{ margin: '0 0 0 0', paddingLeft: 24 }}>
            <li style={{ marginBottom: 10 }}>
              ChapaRide is a platform connecting drivers and passengers. We do not provide transport
              services directly.
            </li>
            <li style={{ marginBottom: 0 }}>
              We are not liable for any damages, injuries, or losses that occur during a ride. Users
              accept responsibility for their own safety.
            </li>
          </ul>
        </Section>

        {/* Section 10: Changes to Terms */}
        <Section number={10} title="Changes to Terms" isMobile={isMobile}>
          <ul style={{ margin: '0 0 0 0', paddingLeft: 24 }}>
            <li style={{ marginBottom: 10 }}>
              ChapaRide may update these Terms from time to time.
            </li>
            <li style={{ marginBottom: 0 }}>
              Continued use of the platform constitutes acceptance of the updated Terms.
            </li>
          </ul>
        </Section>

        {/* Section 11: Contact */}
        <Section number={11} title="Contact" isMobile={isMobile}>
          <p style={{ margin: '0 0 12px 0' }}>
            If you have any questions about these Terms of Service, please contact us:
          </p>
          <div
            style={{
              background: '#f7f8fa',
              borderRadius: 8,
              padding: '16px 20px',
              marginTop: 8,
            }}
          >
            <p style={{ margin: '0 0 6px 0', fontWeight: 600, color: '#333' }}>ChapaRide</p>
            <p style={{ margin: 0 }}>
              Email:{' '}
              <a
                href="mailto:info@chaparide.com"
                style={{ color: '#1A9D9D', textDecoration: 'none', fontWeight: 600 }}
              >
                info@chaparide.com
              </a>
            </p>
          </div>
          <p style={{ margin: '16px 0 0 0' }}>
            You can also review our{' '}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('privacy-policy');
              }}
              style={{ color: '#1A9D9D', textDecoration: 'none', fontWeight: 600 }}
            >
              Privacy Policy
            </a>{' '}
            for details on how we handle your data.
          </p>
        </Section>

        {/* Back to Home Button */}
        <div style={{ textAlign: 'center', marginTop: 40 }}>
          <button
            onClick={() => onNavigate('home')}
            style={{
              background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              padding: '14px 40px',
              fontSize: 16,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'opacity 0.2s, transform 0.2s',
              boxShadow: '0 4px 16px rgba(26,157,157,0.25)',
            }}
            onMouseOver={(e) => {
              (e.currentTarget as HTMLButtonElement).style.opacity = '0.9';
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
            }}
            onMouseOut={(e) => {
              (e.currentTarget as HTMLButtonElement).style.opacity = '1';
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
            }}
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}
