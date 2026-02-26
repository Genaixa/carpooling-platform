import { useState } from 'react';
import { useIsMobile } from '../hooks/useIsMobile';
import type { NavigateFn } from '../lib/types';

interface FAQsProps {
  onNavigate: NavigateFn;
}

interface FAQ {
  question: string;
  answer: string;
}

interface FAQCategory {
  title: string;
  icon: React.ReactNode;
  faqs: FAQ[];
}

export default function FAQs({ onNavigate }: FAQsProps) {
  const isMobile = useIsMobile();
  const [expandedIndex, setExpandedIndex] = useState<string | null>(null);

  const toggleFAQ = (id: string) => {
    setExpandedIndex(prev => prev === id ? null : id);
  };

  const categories: FAQCategory[] = [
    {
      title: 'General',
      icon: (
        <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      faqs: [
        {
          question: 'What is ChapaRide?',
          answer: 'ChapaRide is a carpooling platform that connects drivers with spare seats to passengers looking for affordable rides across the UK. It\'s designed for cost-sharing, not profit.',
        },
        {
          question: 'How does ChapaRide work?',
          answer: 'Drivers post available rides with their route, date, and price. Passengers search for rides, book seats, and pay securely online. The driver accepts or declines the booking, and contact details are shared 24 hours before departure.',
        },
        {
          question: 'Is ChapaRide available outside the UK?',
          answer: 'Currently, ChapaRide operates exclusively within the United Kingdom.',
        },
      ],
    },
    {
      title: 'For Passengers',
      icon: (
        <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
      faqs: [
        {
          question: 'How do I book a ride?',
          answer: 'Search for rides on our homepage by entering your departure and arrival locations. Browse available rides, select one that suits you, and book your seats. You\'ll pay securely through our payment system.',
        },
        {
          question: 'When will I be charged?',
          answer: 'When you book a ride, your card is authorised (a hold is placed) but not charged. The payment is only captured when the driver accepts your booking. If the driver declines, the hold is released automatically.',
        },
        {
          question: 'What is the cancellation policy for passengers?',
          answer: 'If you cancel more than 48 hours before departure, you receive a 75% refund. Cancellations within 48 hours of departure are non-refundable.',
        },
        {
          question: 'When can I see the driver\'s contact details?',
          answer: 'For privacy and safety, contact details are normally shared 24 hours before the scheduled departure time. However, if your journey is before midday on the day after Shabbat or a Yom Tov, contact details will be made available from 8am on the day Shabbat or Yom Tov begins — so that both driver and passenger have time to make arrangements before the restricted period starts.',
        },
        {
          question: 'Can children travel on ChapaRide?',
          answer: 'Children under 12 cannot travel alone. Children aged 12-15 may travel with parental or guardian consent. Passengers aged 16 and over may travel independently.',
        },
      ],
    },
    {
      title: 'For Drivers',
      icon: (
        <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      ),
      faqs: [
        {
          question: 'How do I become a driver?',
          answer: 'Create an account, then submit a driver application with your driving licence details, vehicle information, insurance details, and bank details for payouts. Our team reviews every application manually.',
        },
        {
          question: 'What do I need to drive on ChapaRide?',
          answer: 'You need a valid UK driving licence, a vehicle with at least third-party insurance, a valid MOT, and current road tax. Your vehicle must be roadworthy and legally compliant.',
        },
        {
          question: 'How much can I charge?',
          answer: 'You set your own price per seat. Prices should reflect genuine cost-sharing (fuel, tolls, wear and tear). ChapaRide is not a taxi service and rides must not be used for profit.',
        },
        {
          question: 'How do I get paid?',
          answer: 'ChapaRide retains a 25% platform commission. The remaining 75% is paid out to you via bank transfer after the ride is completed.',
        },
        {
          question: 'What if I need to cancel a ride?',
          answer: 'If you cancel a ride with confirmed bookings, all affected passengers will receive a full 100% refund. Frequent cancellations may affect your driver status.',
        },
      ],
    },
    {
      title: 'Safety & Trust',
      icon: (
        <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      faqs: [
        {
          question: 'Is ChapaRide safe?',
          answer: 'All drivers are vetted and approved before they can offer rides. Our compatibility matching system pairs passengers with suitable drivers. Both parties can leave reviews after each journey.',
        },
        {
          question: 'How does the review system work?',
          answer: 'After a completed ride, both drivers and passengers can leave reviews and ratings for each other. Reviews help the community make informed decisions and promote accountability.',
        },
        {
          question: 'How do I report a problem?',
          answer: 'Contact us at info@chaparide.com with details of your concern. We take all reports seriously and will investigate promptly.',
        },
      ],
    },
    {
      title: 'Payments',
      icon: (
        <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      ),
      faqs: [
        {
          question: 'How are payments processed?',
          answer: 'All payments are processed securely through Square. Your full card details are never stored on our servers.',
        },
        {
          question: 'What happens if a driver doesn\'t accept my booking?',
          answer: 'If a driver doesn\'t respond to or declines your booking, the hold on your card is automatically released and you won\'t be charged.',
        },
      ],
    },
  ];

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
          <h1 style={{ fontSize: isMobile ? '28px' : '42px', fontWeight: 'bold', marginBottom: '12px' }}>
            Frequently Asked Questions
          </h1>
          <p style={{ fontSize: isMobile ? '15px' : '18px', color: 'rgba(255,255,255,0.9)', maxWidth: '600px', margin: '0 auto' }}>
            Find answers to common questions about using ChapaRide.
          </p>
        </div>
      </section>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: isMobile ? '40px 16px 64px' : '56px 20px 80px' }}>

        {categories.map((category, catIdx) => (
          <div key={catIdx} style={{ marginBottom: '40px' }}>
            {/* Category Heading */}
            <h2 style={{
              fontSize: isMobile ? '20px' : '24px',
              fontWeight: 'bold',
              color: '#1A9D9D',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)',
                color: 'white',
                flexShrink: 0,
              }}>
                {category.icon}
              </span>
              {category.title}
            </h2>

            {/* FAQ Items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {category.faqs.map((faq, faqIdx) => {
                const faqId = `${catIdx}-${faqIdx}`;
                const isExpanded = expandedIndex === faqId;

                return (
                  <div
                    key={faqId}
                    style={{
                      backgroundColor: 'white',
                      borderRadius: '12px',
                      border: isExpanded ? '1px solid #1A9D9D' : '1px solid #E8EBED',
                      boxShadow: isExpanded
                        ? '0 4px 16px rgba(26,157,157,0.12)'
                        : '0 2px 8px rgba(0,0,0,0.04)',
                      transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Question (clickable header) */}
                    <button
                      onClick={() => toggleFAQ(faqId)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '16px',
                        padding: isMobile ? '16px' : '20px 24px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontSize: isMobile ? '15px' : '16px',
                        fontWeight: '600',
                        color: isExpanded ? '#1A9D9D' : '#1F2937',
                        lineHeight: '1.5',
                        transition: 'color 0.2s ease',
                      }}
                    >
                      <span style={{ flex: 1 }}>{faq.question}</span>
                      <span style={{
                        fontSize: '14px',
                        color: isExpanded ? '#1A9D9D' : '#9CA3AF',
                        flexShrink: 0,
                        transition: 'transform 0.3s ease, color 0.2s ease',
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '24px',
                        height: '24px',
                      }}>
                        &#9660;
                      </span>
                    </button>

                    {/* Answer (expandable) */}
                    <div style={{
                      maxHeight: isExpanded ? '500px' : '0px',
                      opacity: isExpanded ? 1 : 0,
                      overflow: 'hidden',
                      transition: 'max-height 0.3s ease, opacity 0.25s ease',
                    }}>
                      <div style={{
                        padding: isMobile ? '0 16px 16px' : '0 24px 20px',
                        fontSize: '14px',
                        color: '#4B5563',
                        lineHeight: '1.8',
                        borderTop: '1px solid #F3F4F6',
                        paddingTop: '16px',
                        marginTop: '0',
                      }}>
                        {faq.answer}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Still have questions CTA */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(26,157,157,0.06) 0%, rgba(139,195,74,0.06) 100%)',
          borderRadius: '20px',
          padding: isMobile ? '28px 20px' : '40px',
          border: '1px solid rgba(26,157,157,0.15)',
          textAlign: 'center',
          marginBottom: '40px',
        }}>
          <h3 style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: 'bold', color: '#1F2937', marginBottom: '8px' }}>
            Still have questions?
          </h3>
          <p style={{ fontSize: '14px', color: '#4B5563', lineHeight: '1.7', marginBottom: '20px' }}>
            We're here to help. Reach out to us and we'll get back to you as soon as possible.
          </p>
          <a
            href="mailto:info@chaparide.com"
            style={{
              display: 'inline-block',
              padding: '12px 28px',
              background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)',
              color: 'white',
              borderRadius: '50px',
              fontSize: '15px',
              fontWeight: '700',
              textDecoration: 'none',
              boxShadow: '0 4px 16px rgba(26,157,157,0.3)',
            }}
          >
            Contact Us
          </a>
        </div>

        {/* Back to Home */}
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={() => onNavigate('home')}
            style={{
              padding: '14px 32px',
              background: 'none',
              color: '#1A9D9D',
              borderRadius: '50px',
              fontSize: '16px',
              fontWeight: '700',
              border: '2px solid #1A9D9D',
              cursor: 'pointer',
            }}
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}
