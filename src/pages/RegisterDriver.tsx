import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useIsMobile } from '../hooks/useIsMobile';
import type { NavigateFn } from '../lib/types';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || '';

interface RegisterDriverProps {
  onNavigate: NavigateFn;
}

export default function RegisterDriver({ onNavigate }: RegisterDriverProps) {
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
    ageGroup: '',
    maritalStatus: '',
    yearsExperience: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    bankAccountName: '',
    bankAccountNumber: '',
    bankSortCode: '',
  });

  const [hasDriversLicense, setHasDriversLicense] = useState(false);
  const [confirmedAge, setConfirmedAge] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const [licencePhotoFile, setLicencePhotoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLicenceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'].includes(file.type)) {
      toast.error('Please select a JPG, PNG, or PDF file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File must be under 5MB');
      return;
    }
    setLicencePhotoFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Account validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return;
    }
    if (/\d{5,}/.test(formData.email) || /^[\d\s+\-()]+$/.test(formData.email)) {
      setError('Please enter an email address, not a phone number, in the Email field');
      return;
    }
    if (formData.phone.includes('@')) {
      setError('Please enter a phone number, not an email address, in the Phone Number field');
      return;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
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

    // Driver application validation
    if (!formData.yearsExperience) {
      setError('Please enter your years of driving experience');
      return;
    }
    if (!hasDriversLicense) {
      setError('You must confirm your driving licence, insurance and MOT compliance');
      return;
    }
    if (!formData.emergencyContactName.trim()) {
      setError('Please enter an emergency contact name');
      return;
    }
    if (!formData.emergencyContactPhone.trim()) {
      setError('Please enter an emergency contact phone number');
      return;
    }
    if (!formData.bankAccountName.trim()) {
      setError('Please enter the account holder name');
      return;
    }
    if (!/^\d{8}$/.test(formData.bankAccountNumber.trim())) {
      setError('Account number must be exactly 8 digits');
      return;
    }
    if (!/^\d{2}-?\d{2}-?\d{2}$/.test(formData.bankSortCode.trim())) {
      setError('Sort code must be 6 digits (e.g., 12-34-56)');
      return;
    }
    if (!confirmedAge) {
      setError('You must confirm that you are 18 years of age or over');
      return;
    }
    if (!agreedToTerms) {
      setError('You must agree to the Privacy Policy and Terms of Service');
      return;
    }

    setLoading(true);
    try {
      // Step 1: Create account
      await signUp(formData.email, formData.password, {
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
      });

      // Step 2: Get session for userId and access token
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      const accessToken = session?.access_token;

      if (!userId) throw new Error('Account created but could not get user session. Please log in to complete your application.');

      // Step 3: Upload licence photo if selected
      let licencePhotoUrl: string | null = null;
      if (licencePhotoFile && accessToken) {
        try {
          const uploadForm = new FormData();
          uploadForm.append('photo', licencePhotoFile);
          uploadForm.append('userId', userId);
          const res = await fetch(`${API_URL}/api/upload-application-licence-photo`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}` },
            body: uploadForm,
          });
          const data = await res.json();
          if (res.ok) {
            licencePhotoUrl = data.url;
            await supabase.from('profiles').update({ licence_photo_url: licencePhotoUrl, licence_status: 'pending' }).eq('id', userId);
          }
        } catch {
          // Non-fatal: continue without licence photo
        }
      }

      // Step 4: Insert driver application
      const { error: appError } = await supabase.from('driver_applications').insert([{
        user_id: userId,
        first_name: formData.firstName.trim(),
        surname: formData.surname.trim(),
        age_group: formData.ageGroup,
        gender: formData.gender,
        has_drivers_license: hasDriversLicense,
        car_insured: hasDriversLicense,
        has_mot: hasDriversLicense,
        car_make: '',
        car_model: '',
        years_driving_experience: parseInt(formData.yearsExperience),
        dbs_check_acknowledged: false,
        emergency_contact_name: formData.emergencyContactName.trim(),
        emergency_contact_phone: formData.emergencyContactPhone.trim(),
        bank_account_name: formData.bankAccountName.trim(),
        bank_account_number: formData.bankAccountNumber.trim(),
        bank_sort_code: formData.bankSortCode.trim(),
        status: 'pending',
      }]);

      if (appError) throw appError;

      // Step 5: Notify admin
      fetch(`${API_URL}/api/notify-driver-application`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          application: {
            first_name: formData.firstName.trim(),
            surname: formData.surname.trim(),
            age_group: formData.ageGroup,
            gender: formData.gender,
            car_make: '',
            car_model: '',
            years_driving_experience: parseInt(formData.yearsExperience),
          },
        }),
      }).catch(() => {});

      toast.success('Account created and driver application submitted! We will review it shortly.');
      onNavigate('home');
    } catch (err: any) {
      setError(err.message || 'Failed to submit application');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '14px', fontSize: '16px',
    border: '2px solid #E8EBED', borderRadius: '12px',
    backgroundColor: 'white', transition: 'border-color 0.3s',
    boxSizing: 'border-box',
  };

  const sectionHeaderStyle: React.CSSProperties = {
    fontSize: '18px', fontWeight: '700', color: '#1F2937',
    margin: '32px 0 20px 0', paddingBottom: '10px',
    borderBottom: '2px solid #fcd03a',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '14px', fontWeight: '600',
    color: '#1F2937', marginBottom: '8px',
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFB' }}>
      <section style={{
        background: '#fcd03a',
        padding: isMobile ? '32px 16px 60px' : '60px 20px 100px',
      }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: isMobile ? '24px' : '40px' }}>
            <h1 style={{ fontSize: isMobile ? '28px' : '48px', fontWeight: 'bold', color: '#000000', marginBottom: '12px' }}>
              Become a Driver
            </h1>
            <p style={{ fontSize: isMobile ? '16px' : '20px', color: 'rgba(0,0,0,0.7)' }}>
              Create your account and submit your driver application
            </p>
          </div>

          <div style={{
            backgroundColor: 'white', borderRadius: '24px',
            padding: isMobile ? '24px' : '40px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          }}>
            <form onSubmit={handleSubmit}>
              {error && (
                <div style={{
                  backgroundColor: '#fee2e2', border: '1px solid #fca5a5',
                  borderRadius: '12px', padding: '16px', marginBottom: '24px',
                }}>
                  <p style={{ color: '#991b1b', margin: 0 }}>{error}</p>
                </div>
              )}

              {/* ── 1. Your Account ── */}
              <p style={sectionHeaderStyle}>1. Your Account</p>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label style={labelStyle}>First Name *</label>
                  <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} required placeholder="John" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Surname *</label>
                  <input type="text" name="surname" value={formData.surname} onChange={handleChange} required placeholder="Smith" style={inputStyle} />
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Email Address *</label>
                <input type="email" name="email" value={formData.email} onChange={handleChange} required placeholder="your.email@example.com" style={inputStyle} />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Phone Number *</label>
                <input type="tel" name="phone" value={formData.phone} onChange={handleChange} required placeholder="07123 456789" style={inputStyle} />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Address Line 1 *</label>
                <input type="text" name="addressLine1" value={formData.addressLine1} onChange={handleChange} required placeholder="123 High Street" style={inputStyle} />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Address Line 2</label>
                <input type="text" name="addressLine2" value={formData.addressLine2} onChange={handleChange} placeholder="Flat 4, Building Name (optional)" style={inputStyle} />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>City / Town *</label>
                <input type="text" name="city" value={formData.city} onChange={handleChange} required placeholder="London" style={inputStyle} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label style={labelStyle}>Postcode *</label>
                  <input type="text" name="postcode" value={formData.postcode} onChange={handleChange} required placeholder="SW1A 1AA" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Country *</label>
                  <input type="text" name="country" value={formData.country} onChange={handleChange} required style={inputStyle} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label style={labelStyle}>Gender *</label>
                  <select name="gender" value={formData.gender} onChange={handleChange} required style={inputStyle}>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Age Group *</label>
                  <select name="ageGroup" value={formData.ageGroup} onChange={handleChange} required style={inputStyle}>
                    <option value="">Select age group</option>
                    <option value="18-25">18-25</option>
                    <option value="26-35">26-35</option>
                    <option value="36-45">36-45</option>
                    <option value="46-55">46-55</option>
                    <option value="56+">56+</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Marital Status *</label>
                <select name="maritalStatus" value={formData.maritalStatus} onChange={handleChange} required style={inputStyle}>
                  <option value="">Select marital status</option>
                  <option value="Single">Single</option>
                  <option value="Married">Married</option>
                </select>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Password *</label>
                <input type="password" name="password" value={formData.password} onChange={handleChange} required placeholder="Minimum 6 characters" style={inputStyle} />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Confirm Password *</label>
                <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} required placeholder="Re-enter your password" style={inputStyle} />
              </div>

              {/* ── 2. Driving Experience ── */}
              <p style={sectionHeaderStyle}>2. Driving Experience</p>

              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Years of Driving Experience *</label>
                <input type="number" name="yearsExperience" min="0" value={formData.yearsExperience} onChange={handleChange} style={{ ...inputStyle, maxWidth: '200px' }} />
              </div>

              {/* ── 3. Compliance ── */}
              <p style={sectionHeaderStyle}>3. Compliance</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={hasDriversLicense}
                    onChange={(e) => setHasDriversLicense(e.target.checked)}
                    style={{ width: '20px', height: '20px', marginTop: '2px', accentColor: '#fcd03a', flexShrink: 0 }}
                  />
                  <span style={{ fontSize: '14px', color: '#1F2937', lineHeight: '1.5' }}>I have a valid driving licence that permits me to legally drive in the UK, my car is fully insured, and my car has a valid MOT certificate *</span>
                </label>
              </div>

              {/* ── Licence Photo (optional) ── */}
              <div style={{
                backgroundColor: '#fef9e0', border: '1px solid #fcd03a',
                borderRadius: '16px', padding: '20px', marginBottom: '8px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '20px' }}>&#11088;</span>
                  <h4 style={{ fontSize: '16px', fontWeight: '700', color: '#000000', margin: 0 }}>
                    Upload Your Driving Licence — Unlock Gold Status
                  </h4>
                </div>
                <p style={{ fontSize: '13px', color: '#374151', marginBottom: '4px', lineHeight: '1.6' }}>
                  <strong>Optional.</strong> Uploading a clear photo of your driving licence unlocks <strong>Gold Status Driver</strong> — higher visibility and greater trust with passengers. It also speeds up your approval.
                </p>
                <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '14px' }}>
                  Stored securely and only visible to our admin team. JPG, PNG, or PDF · max 5MB.
                </p>
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,application/pdf"
                  onChange={handleLicenceFileChange}
                  style={{ fontSize: '14px', color: '#4B5563' }}
                />
                {licencePhotoFile && (
                  <p style={{ fontSize: '13px', color: '#059669', marginTop: '8px', fontWeight: '600' }}>
                    {licencePhotoFile.name} selected — will be uploaded on submission
                  </p>
                )}
              </div>

              {/* ── 4. Emergency Contact ── */}
              <p style={sectionHeaderStyle}>4. Emergency Contact</p>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label style={labelStyle}>Contact Name *</label>
                  <input type="text" name="emergencyContactName" value={formData.emergencyContactName} onChange={handleChange} required style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Contact Phone *</label>
                  <input type="tel" name="emergencyContactPhone" value={formData.emergencyContactPhone} onChange={handleChange} required style={inputStyle} />
                </div>
              </div>

              {/* ── 5. Bank Details ── */}
              <p style={sectionHeaderStyle}>5. Bank Details</p>
              <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '20px', marginTop: '-12px' }}>
                Your payout for completed rides will be sent to this account.
              </p>

              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Account Holder Name *</label>
                <input type="text" name="bankAccountName" value={formData.bankAccountName} onChange={handleChange} required placeholder="Name on bank account" style={inputStyle} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label style={labelStyle}>Account Number *</label>
                  <input type="text" name="bankAccountNumber" value={formData.bankAccountNumber} onChange={handleChange} required placeholder="8 digits" maxLength={8} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Sort Code *</label>
                  <input type="text" name="bankSortCode" value={formData.bankSortCode} onChange={handleChange} required placeholder="e.g., 12-34-56" maxLength={8} style={inputStyle} />
                </div>
              </div>

              {/* ── 6. Declarations ── */}
              <p style={sectionHeaderStyle}>6. Declarations</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
                <div style={{ backgroundColor: '#f8fafc', border: '2px solid #E8EBED', borderRadius: '12px', padding: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={confirmedAge}
                      onChange={(e) => setConfirmedAge(e.target.checked)}
                      style={{ width: '20px', height: '20px', marginTop: '2px', flexShrink: 0, accentColor: '#fcd03a' }}
                    />
                    <span style={{ fontSize: '14px', lineHeight: '1.5', color: '#374151' }}>
                      I confirm that I am 18 years of age or over.
                    </span>
                  </label>
                </div>
                <div style={{ backgroundColor: '#f8fafc', border: '2px solid #E8EBED', borderRadius: '12px', padding: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      style={{ width: '20px', height: '20px', marginTop: '2px', flexShrink: 0, accentColor: '#fcd03a' }}
                    />
                    <span style={{ fontSize: '14px', lineHeight: '1.5', color: '#374151' }}>
                      I confirm that I have read and agree to ChapaRide's{' '}
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); onNavigate('privacy-policy'); }}
                        style={{ background: 'none', border: 'none', color: '#fcd03a', fontWeight: '600', cursor: 'pointer', textDecoration: 'underline', padding: 0, fontSize: '14px', fontFamily: 'inherit' }}
                      >
                        Privacy Policy
                      </button>
                      {' '}and{' '}
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); onNavigate('terms'); }}
                        style={{ background: 'none', border: 'none', color: '#fcd03a', fontWeight: '600', cursor: 'pointer', textDecoration: 'underline', padding: 0, fontSize: '14px', fontFamily: 'inherit' }}
                      >
                        Terms of Service
                      </button>.
                    </span>
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%', padding: '18px', fontSize: '18px', fontWeight: '600',
                  background: loading ? '#D1D5DB' : '#000000',
                  color: loading ? '#9CA3AF' : '#fcd03a',
                  border: 'none', borderRadius: '12px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: loading ? 'none' : '0 8px 20px rgba(252,208,58,0.25)',
                  transition: 'all 0.3s',
                }}
              >
                {loading ? 'Submitting application...' : 'Create Account & Submit Application'}
              </button>
            </form>

            <div style={{ marginTop: '30px', textAlign: 'center', paddingTop: '25px', borderTop: '1px solid #E8EBED' }}>
              <p style={{ color: '#4B5563', fontSize: '16px', margin: 0 }}>
                Already have an account?{' '}
                <button
                  onClick={() => onNavigate('login')}
                  style={{ background: 'none', border: 'none', color: '#fcd03a', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Sign in
                </button>
              </p>
            </div>
          </div>
        </div>
      </section>

      <style>{`
        input:focus, select:focus { outline: none; border-color: #fcd03a !important; box-shadow: 0 0 0 4px rgba(252,208,58,0.15); }
        button:hover:not(:disabled) { transform: translateY(-2px); }
      `}</style>
    </div>
  );
}
