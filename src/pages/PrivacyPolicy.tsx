import React from 'react';
import { NavigateFn } from '../lib/types';
import { useIsMobile } from '../hooks/useIsMobile';

interface PrivacyPolicyProps {
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

export default function PrivacyPolicy({ onNavigate }: PrivacyPolicyProps) {
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
          Privacy Policy
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
            ChapaRide ("we," "our," or "us") is committed to protecting your privacy. This Privacy
            Policy explains how we collect, use, and protect your personal information when you use
            our website and services.
          </p>
        </div>

        {/* Section 1: Information We Collect */}
        <Section number={1} title="Information We Collect" isMobile={isMobile}>
          <p style={{ margin: '0 0 12px 0' }}>
            When you use ChapaRide, we may collect the following information:
          </p>
          <ul style={{ margin: '0 0 0 0', paddingLeft: 24 }}>
            <li style={{ marginBottom: 10 }}>
              <strong>Account information:</strong> Name, email, phone number, and password.
            </li>
            <li style={{ marginBottom: 10 }}>
              <strong>Journey information:</strong> Rides you publish or join, pickup/drop-off
              locations, and travel preferences.
            </li>
            <li style={{ marginBottom: 0 }}>
              <strong>Usage data:</strong> How you use the ChapaRide website or app, including login
              times and activity logs.
            </li>
          </ul>
        </Section>

        {/* Section 2: How We Use Your Information */}
        <Section number={2} title="How We Use Your Information" isMobile={isMobile}>
          <p style={{ margin: '0 0 12px 0' }}>We use the information you provide to:</p>
          <ul style={{ margin: '0 0 0 0', paddingLeft: 24 }}>
            <li style={{ marginBottom: 10 }}>
              Verify your account and eligibility to use ChapaRide.
            </li>
            <li style={{ marginBottom: 10 }}>
              Facilitate carpooling and communicate with passengers or drivers.
            </li>
            <li style={{ marginBottom: 10 }}>
              Improve our services and website functionality.
            </li>
            <li style={{ marginBottom: 0 }}>
              Comply with legal obligations and prevent fraud or misuse.
            </li>
          </ul>
        </Section>

        {/* Section 3: Sharing Your Information */}
        <Section number={3} title="Sharing Your Information" isMobile={isMobile}>
          <p style={{ margin: '0 0 12px 0' }}>
            We do not sell or rent your personal information. We may share your information with:
          </p>
          <ul style={{ margin: '0 0 0 0', paddingLeft: 24 }}>
            <li style={{ marginBottom: 10 }}>
              <strong>Passengers or drivers:</strong> To coordinate shared journeys.
            </li>
            <li style={{ marginBottom: 10 }}>
              <strong>Service providers:</strong> Third-party services that help us operate the
              platform (e.g., payment processors).
            </li>
            <li style={{ marginBottom: 0 }}>
              <strong>Legal authorities:</strong> Where required by law or to protect ChapaRide, our
              users, or others.
            </li>
          </ul>
        </Section>

        {/* Section 4: Your Rights */}
        <Section number={4} title="Your Rights" isMobile={isMobile}>
          <p style={{ margin: '0 0 12px 0' }}>You have the right to:</p>
          <ul style={{ margin: '0 0 0 0', paddingLeft: 24 }}>
            <li style={{ marginBottom: 10 }}>
              Access the personal information we hold about you.
            </li>
            <li style={{ marginBottom: 10 }}>
              Request correction or deletion of your data.
            </li>
            <li style={{ marginBottom: 10 }}>
              Withdraw consent to use your data where applicable.
            </li>
            <li style={{ marginBottom: 0 }}>
              Object to or restrict certain types of processing.
            </li>
          </ul>
        </Section>

        {/* Section 5: Data Security */}
        <Section number={5} title="Data Security" isMobile={isMobile}>
          <p style={{ margin: 0 }}>
            We implement appropriate technical and organizational measures to protect your data from
            unauthorized access, disclosure, or destruction.
          </p>
        </Section>

        {/* Section 6: Data Retention */}
        <Section number={6} title="Data Retention" isMobile={isMobile}>
          <p style={{ margin: 0 }}>
            We retain personal information only as long as necessary to provide our services, comply
            with legal obligations, and resolve disputes.
          </p>
        </Section>

        {/* Section 7: Cookies and Tracking */}
        <Section number={7} title="Cookies and Tracking" isMobile={isMobile}>
          <p style={{ margin: 0 }}>
            ChapaRide may use cookies and similar technologies to enhance your experience, analyze
            website traffic, and personalize content. You can manage cookies in your browser
            settings.
          </p>
        </Section>

        {/* Section 8: Changes to This Privacy Policy */}
        <Section number={8} title="Changes to This Privacy Policy" isMobile={isMobile}>
          <p style={{ margin: 0 }}>
            We may update this Privacy Policy from time to time. The latest version will always be
            available on our website. Continued use of ChapaRide constitutes acceptance of any
            changes.
          </p>
        </Section>

        {/* Section 9: Contact */}
        <Section number={9} title="Contact" isMobile={isMobile}>
          <p style={{ margin: '0 0 12px 0' }}>
            If you have any questions about this Privacy Policy, please contact us:
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
                onNavigate('terms');
              }}
              style={{ color: '#1A9D9D', textDecoration: 'none', fontWeight: 600 }}
            >
              Terms of Service
            </a>{' '}
            for details on the rules governing your use of ChapaRide.
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
