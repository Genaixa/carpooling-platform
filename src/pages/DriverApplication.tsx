import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { AGE_GROUP_OPTIONS, GENDER_OPTIONS } from '../lib/constants';
import { useIsMobile } from '../hooks/useIsMobile';
import type { NavigateFn } from '../lib/types';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || '';

interface DriverApplicationProps {
  onNavigate: NavigateFn;
}

export default function DriverApplication({ onNavigate }: DriverApplicationProps) {
  const { user, profile, loading: authLoading } = useAuth();
  const isMobile = useIsMobile();
  const [existingApplication, setExistingApplication] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    surname: '',
    age_group: '',
    gender: '',
    has_drivers_license: false,
    car_insured: false,
    has_mot: false,
    car_make: '',
    car_model: '',
    years_driving_experience: '',
    dbs_check_acknowledged: false,
    emergency_contact_name: '',
    emergency_contact_phone: '',
    bank_account_name: '',
    bank_account_number: '',
    bank_sort_code: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [licencePhotoUrl, setLicencePhotoUrl] = useState<string | null>(null);
  const [licencePhotoFile, setLicencePhotoFile] = useState<File | null>(null);
  const [uploadingLicencePhoto, setUploadingLicencePhoto] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      sessionStorage.setItem('loginRedirect', 'driver-apply');
      onNavigate('login');
    }
  }, [user, authLoading, onNavigate]);

  useEffect(() => {
    if (user) loadExistingApplication();
  }, [user]);

  // Pre-fill form with previous application data when reapplying, or from profile
  useEffect(() => {
    if (loading) return;
    if (existingApplication?.status === 'rejected') {
      setFormData({
        first_name: existingApplication.first_name || '',
        surname: existingApplication.surname || '',
        age_group: existingApplication.age_group || '',
        gender: existingApplication.gender || '',
        has_drivers_license: existingApplication.has_drivers_license || false,
        car_insured: existingApplication.car_insured || false,
        has_mot: existingApplication.has_mot || false,
        car_make: existingApplication.car_make || '',
        car_model: existingApplication.car_model || '',
        years_driving_experience: existingApplication.years_driving_experience?.toString() || '',
        dbs_check_acknowledged: existingApplication.dbs_check_acknowledged || false,
        emergency_contact_name: existingApplication.emergency_contact_name || '',
        emergency_contact_phone: existingApplication.emergency_contact_phone || '',
        bank_account_name: existingApplication.bank_account_name || '',
        bank_account_number: existingApplication.bank_account_number || '',
        bank_sort_code: existingApplication.bank_sort_code || '',
      });
    } else if (!existingApplication && profile) {
      const nameParts = (profile.name || '').trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const surname = nameParts.slice(1).join(' ') || '';
      setFormData(prev => ({
        ...prev,
        first_name: firstName,
        surname: surname,
        gender: profile.gender || '',
        age_group: profile.age_group || '',
      }));
    }
  }, [existingApplication, profile, loading]);

  const loadExistingApplication = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('driver_applications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) setExistingApplication(data);
    } catch (err) {
      console.error('Error loading application:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    if (errors[name]) {
      setErrors(prev => { const n = { ...prev }; delete n[name]; return n; });
    }
  };

  const handleLicenceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
      toast.error('Please select a JPG or PNG image');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }
    setLicencePhotoFile(file);
  };

  const handleLicenceUpload = async () => {
    if (!licencePhotoFile || !user) return;
    setUploadingLicencePhoto(true);
    try {
      const formData = new FormData();
      formData.append('photo', licencePhotoFile);
      formData.append('userId', user.id);
      const res = await fetch(`${API_URL}/api/upload-application-licence-photo`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setLicencePhotoUrl(data.url);
      setLicencePhotoFile(null);
      toast.success('Licence photo uploaded');
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploadingLicencePhoto(false);
    }
  };

  const handleLicenceDelete = async () => {
    if (!user) return;
    try {
      await fetch(`${API_URL}/api/delete-licence-photo`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      setLicencePhotoUrl(null);
      setLicencePhotoFile(null);
      toast.success('Licence photo removed');
    } catch {
      toast.error('Failed to remove photo');
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.first_name.trim()) newErrors.first_name = 'First name is required';
    if (!formData.surname.trim()) newErrors.surname = 'Surname is required';
    if (!formData.age_group) newErrors.age_group = 'Age group is required';
    if (!formData.gender) newErrors.gender = 'Gender is required';
    if (!formData.has_drivers_license) newErrors.has_drivers_license = 'You must have a valid driving licence';
    if (!formData.car_insured) newErrors.car_insured = 'Your car must be insured';
    if (!formData.has_mot) newErrors.has_mot = 'Your car must have a valid MOT';

    if (!formData.years_driving_experience) newErrors.years_driving_experience = 'Years of experience is required';
    if (!formData.emergency_contact_name.trim()) newErrors.emergency_contact_name = 'Emergency contact name is required';
    if (!formData.emergency_contact_phone.trim()) newErrors.emergency_contact_phone = 'Emergency contact phone is required';
    if (!formData.bank_account_name.trim()) newErrors.bank_account_name = 'Account name is required';
    if (!formData.bank_account_number.trim()) newErrors.bank_account_number = 'Account number is required';
    else if (!/^\d{8}$/.test(formData.bank_account_number.trim())) newErrors.bank_account_number = 'Account number must be 8 digits';
    if (!formData.bank_sort_code.trim()) newErrors.bank_sort_code = 'Sort code is required';
    else if (!/^\d{2}-?\d{2}-?\d{2}$/.test(formData.bank_sort_code.trim())) newErrors.bank_sort_code = 'Sort code must be 6 digits (e.g., 12-34-56)';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !validateForm()) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from('driver_applications').insert([{
        user_id: user.id,
        first_name: formData.first_name.trim(),
        surname: formData.surname.trim(),
        age_group: formData.age_group,
        gender: formData.gender,
        has_drivers_license: formData.has_drivers_license,
        car_insured: formData.car_insured,
        has_mot: formData.has_mot,
        car_make: formData.car_make.trim(),
        car_model: formData.car_model.trim(),
        years_driving_experience: parseInt(formData.years_driving_experience),
        dbs_check_acknowledged: formData.dbs_check_acknowledged,
        emergency_contact_name: formData.emergency_contact_name.trim(),
        emergency_contact_phone: formData.emergency_contact_phone.trim(),
        bank_account_name: formData.bank_account_name.trim(),
        bank_account_number: formData.bank_account_number.trim(),
        bank_sort_code: formData.bank_sort_code.trim(),
        status: 'pending',
      }]);

      if (error) throw error;
      toast.success('Application submitted successfully! We will review it shortly.');

      // Notify admin by email
      fetch(`${API_URL}/api/notify-driver-application`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ application: {
          first_name: formData.first_name.trim(),
          surname: formData.surname.trim(),
          age_group: formData.age_group,
          gender: formData.gender,
          car_make: formData.car_make.trim(),
          car_model: formData.car_model.trim(),
          years_driving_experience: parseInt(formData.years_driving_experience),
        }}),
      }).catch(() => {});

      loadExistingApplication();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading || !user) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#4B5563' }}>Loading...</div>
      </div>
    );
  }

  if (profile?.is_approved_driver) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFB' }}>
        <div style={{ padding: '80px 20px', textAlign: 'center' }}>
          <div style={{ maxWidth: '600px', margin: '0 auto', backgroundColor: 'white', borderRadius: '20px', padding: '40px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>&#10003;</div>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#166534', marginBottom: '12px' }}>You are an approved driver!</h2>
            <p style={{ color: '#4B5563', marginBottom: '24px' }}>You can post rides from the dashboard.</p>
            <button onClick={() => onNavigate('post-ride')} style={{ padding: '14px 32px', background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '600', cursor: 'pointer' }}>
              Post a Ride
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (existingApplication && existingApplication.status !== 'rejected') {
    const statusColors: Record<string, { bg: string; color: string; border: string }> = {
      pending: { bg: '#fef3c7', color: '#92400e', border: '#fde047' },
      approved: { bg: '#dcfce7', color: '#166534', border: '#86efac' },
    };
    const sc = statusColors[existingApplication.status] || statusColors.pending;

    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFB' }}>
        <div style={{ padding: '80px 20px', textAlign: 'center' }}>
          <div style={{ maxWidth: '600px', margin: '0 auto', backgroundColor: 'white', borderRadius: '20px', padding: '40px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1F2937', marginBottom: '16px' }}>Application Status</h2>
            <span style={{
              display: 'inline-block', padding: '8px 20px', borderRadius: '20px', fontSize: '14px', fontWeight: '600',
              textTransform: 'capitalize', backgroundColor: sc.bg, color: sc.color, border: `1px solid ${sc.border}`,
            }}>
              {existingApplication.status}
            </span>
            {existingApplication.admin_notes && (
              <div style={{ marginTop: '20px', padding: '16px', backgroundColor: '#F8FAFB', borderRadius: '12px', border: '1px solid #E8EBED' }}>
                <p style={{ fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '4px' }}>Admin Notes:</p>
                <p style={{ fontSize: '14px', color: '#4B5563', margin: 0 }}>{existingApplication.admin_notes}</p>
              </div>
            )}
            <button onClick={() => onNavigate('home')} style={{ marginTop: '24px', padding: '14px 32px', background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '600', cursor: 'pointer' }}>
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isReapplying = existingApplication?.status === 'rejected';
  const wasRevoked = existingApplication?.admin_notes?.startsWith('REVOKED:');

  const inputStyle = (field: string) => ({
    width: '100%', padding: '14px', fontSize: '16px',
    border: errors[field] ? '2px solid #ef4444' : '2px solid #E8EBED',
    borderRadius: '12px', transition: 'border-color 0.3s',
  });

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFB' }}>
      <section style={{ background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)', padding: isMobile ? '32px 16px' : '60px 20px', minHeight: 'calc(100vh - 90px)' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: isMobile ? '24px' : '40px' }}>
            <h1 style={{ fontSize: isMobile ? '28px' : '48px', fontWeight: 'bold', color: 'white', marginBottom: '15px', textShadow: '2px 2px 4px rgba(0,0,0,0.2)' }}>
              {isReapplying ? 'Reapply as Driver' : 'Become a Driver'}
            </h1>
            <p style={{ fontSize: '20px', color: 'rgba(255, 255, 255, 0.95)' }}>
              {isReapplying ? 'Submit a new application for review' : 'Complete this application to start offering rides'}
            </p>
          </div>

          {!isReapplying && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: 'rgba(255,255,255,0.6)' }}>Step 1: Create Account</span>
                <span style={{ fontSize: '13px', fontWeight: '700', color: 'white' }}>Step 2: Driver Application</span>
              </div>
              <div style={{ backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: '99px', height: '8px' }}>
                <div style={{ width: '100%', backgroundColor: 'white', borderRadius: '99px', height: '8px' }} />
              </div>
            </div>
          )}

          {isReapplying && (
            <div style={{
              backgroundColor: wasRevoked ? '#fef2f2' : '#fef3c7',
              border: `1px solid ${wasRevoked ? '#fca5a5' : '#fde047'}`,
              borderRadius: '16px', padding: '20px', marginBottom: '24px',
            }}>
              <p style={{ fontSize: '15px', fontWeight: '600', color: wasRevoked ? '#991b1b' : '#92400e', margin: '0 0 6px 0' }}>
                {wasRevoked ? 'Your driver status was revoked' : 'Your previous application was rejected'}
              </p>
              {existingApplication?.admin_notes && (
                <p style={{ fontSize: '14px', color: '#4B5563', margin: 0 }}>
                  Reason: {existingApplication.admin_notes.replace('REVOKED: ', '')}
                </p>
              )}
            </div>
          )}

          <div style={{ backgroundColor: 'white', borderRadius: '24px', padding: isMobile ? '24px' : '40px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <form onSubmit={handleSubmit}>
              {/* Personal Details */}
              <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#1F2937', marginBottom: '20px' }}>Personal Details</h3>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>First Name *</label>
                  <input name="first_name" type="text" value={formData.first_name} onChange={handleChange} style={inputStyle('first_name')} />
                  {errors.first_name && <p style={{ color: '#ef4444', fontSize: '14px', marginTop: '4px' }}>{errors.first_name}</p>}
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>Surname *</label>
                  <input name="surname" type="text" value={formData.surname} onChange={handleChange} style={inputStyle('surname')} />
                  {errors.surname && <p style={{ color: '#ef4444', fontSize: '14px', marginTop: '4px' }}>{errors.surname}</p>}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>Age Group *</label>
                  <select name="age_group" value={formData.age_group} onChange={handleChange} style={{ ...inputStyle('age_group'), backgroundColor: 'white' }}>
                    <option value="">Select age group</option>
                    {AGE_GROUP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  {errors.age_group && <p style={{ color: '#ef4444', fontSize: '14px', marginTop: '4px' }}>{errors.age_group}</p>}
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>Gender *</label>
                  <select name="gender" value={formData.gender} onChange={handleChange} style={{ ...inputStyle('gender'), backgroundColor: 'white' }}>
                    {GENDER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  {errors.gender && <p style={{ color: '#ef4444', fontSize: '14px', marginTop: '4px' }}>{errors.gender}</p>}
                </div>
              </div>

              {/* Vehicle & Driving */}
              <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#1F2937', marginBottom: '20px', marginTop: '30px' }}>Vehicle & Driving</h3>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>Years of Driving Experience *</label>
                <input name="years_driving_experience" type="number" min="0" value={formData.years_driving_experience} onChange={handleChange} style={{ ...inputStyle('years_driving_experience'), maxWidth: '200px' }} />
                {errors.years_driving_experience && <p style={{ color: '#ef4444', fontSize: '14px', marginTop: '4px' }}>{errors.years_driving_experience}</p>}
              </div>

              {/* Compliance Checks */}
              <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#1F2937', marginBottom: '20px', marginTop: '30px' }}>Compliance</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
                {[
                  { name: 'has_drivers_license', label: 'I have a valid driving licence that permits me to legally drive in the UK' },
                  { name: 'car_insured', label: 'My car is fully insured' },
                  { name: 'has_mot', label: 'My car has a valid MOT certificate' },
                ].map(({ name, label }) => (
                  <label key={name} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                    <input type="checkbox" name={name} checked={(formData as any)[name]} onChange={handleChange} style={{ width: '20px', height: '20px', accentColor: '#1A9D9D' }} />
                    <span style={{ fontSize: '14px', color: '#1F2937' }}>{label} *</span>
                  </label>
                ))}
                {(errors.has_drivers_license || errors.car_insured || errors.has_mot) && (
                  <p style={{ color: '#ef4444', fontSize: '14px' }}>All compliance checks must be confirmed</p>
                )}
              </div>

              {/* Licence Photo Upload */}
              <div style={{
                marginTop: '28px', marginBottom: '10px',
                backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0',
                borderRadius: '16px', padding: '20px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '20px' }}>⭐</span>
                  <h4 style={{ fontSize: '16px', fontWeight: '700', color: '#166534', margin: 0 }}>
                    Upload Your Driving Licence Photo — Unlock Gold Status
                  </h4>
                </div>
                <p style={{ fontSize: '13px', color: '#374151', marginBottom: '4px', lineHeight: '1.6' }}>
                  Uploading a clear photo of your driving licence is <strong>optional</strong>, but it unlocks <strong>Gold Status Driver</strong> — giving you higher visibility and greater trust with passengers. It also <strong>speeds up your approval</strong> as our team can verify your licence directly without follow-up.
                </p>
                <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '16px' }}>
                  Your licence photo is stored securely and is only visible to our admin team.
                </p>

                {licencePhotoUrl ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                    <img
                      src={licencePhotoUrl}
                      alt="Driving licence"
                      style={{ height: '80px', borderRadius: '8px', border: '2px solid #86EFAC', objectFit: 'cover' }}
                    />
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: '600', color: '#166534', margin: '0 0 8px 0' }}>
                        ✓ Licence photo uploaded
                      </p>
                      <button
                        type="button"
                        onClick={handleLicenceDelete}
                        style={{
                          padding: '8px 18px', backgroundColor: '#FEE2E2', color: '#991B1B',
                          border: '1px solid #FCA5A5', borderRadius: '8px',
                          fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                        }}
                      >
                        Remove Photo
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png"
                      onChange={handleLicenceFileChange}
                      disabled={uploadingLicencePhoto}
                      style={{ fontSize: '14px', color: '#4B5563', display: 'block', marginBottom: '12px' }}
                    />
                    {licencePhotoFile && (
                      <button
                        type="button"
                        onClick={handleLicenceUpload}
                        disabled={uploadingLicencePhoto}
                        style={{
                          padding: '10px 24px',
                          background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)',
                          color: 'white', border: 'none', borderRadius: '8px',
                          fontSize: '14px', fontWeight: '600', cursor: 'pointer',
                          opacity: uploadingLicencePhoto ? 0.7 : 1,
                        }}
                      >
                        {uploadingLicencePhoto ? 'Uploading...' : 'Upload Licence Photo'}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Emergency Contact */}
              <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#1F2937', marginBottom: '20px', marginTop: '30px' }}>Emergency Contact</h3>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>Contact Name *</label>
                  <input name="emergency_contact_name" type="text" value={formData.emergency_contact_name} onChange={handleChange} style={inputStyle('emergency_contact_name')} />
                  {errors.emergency_contact_name && <p style={{ color: '#ef4444', fontSize: '14px', marginTop: '4px' }}>{errors.emergency_contact_name}</p>}
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>Contact Phone *</label>
                  <input name="emergency_contact_phone" type="tel" value={formData.emergency_contact_phone} onChange={handleChange} style={inputStyle('emergency_contact_phone')} />
                  {errors.emergency_contact_phone && <p style={{ color: '#ef4444', fontSize: '14px', marginTop: '4px' }}>{errors.emergency_contact_phone}</p>}
                </div>
              </div>

              {/* Bank Details */}
              <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#1F2937', marginBottom: '8px', marginTop: '30px' }}>Bank Details</h3>
              <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '20px' }}>Your payout for completed rides will be sent to this account.</p>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>Account Name *</label>
                  <input name="bank_account_name" type="text" value={formData.bank_account_name} onChange={handleChange} placeholder="Name on bank account" style={inputStyle('bank_account_name')} />
                  {errors.bank_account_name && <p style={{ color: '#ef4444', fontSize: '14px', marginTop: '4px' }}>{errors.bank_account_name}</p>}
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>Account Number *</label>
                  <input name="bank_account_number" type="text" value={formData.bank_account_number} onChange={handleChange} placeholder="8 digits" maxLength={8} style={inputStyle('bank_account_number')} />
                  {errors.bank_account_number && <p style={{ color: '#ef4444', fontSize: '14px', marginTop: '4px' }}>{errors.bank_account_number}</p>}
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>Sort Code *</label>
                  <input name="bank_sort_code" type="text" value={formData.bank_sort_code} onChange={handleChange} placeholder="e.g., 12-34-56" maxLength={8} style={inputStyle('bank_sort_code')} />
                  {errors.bank_sort_code && <p style={{ color: '#ef4444', fontSize: '14px', marginTop: '4px' }}>{errors.bank_sort_code}</p>}
                </div>
              </div>

              <button type="submit" disabled={submitting} style={{
                width: '100%', padding: '18px', fontSize: '18px', fontWeight: '600',
                background: submitting ? '#D1D5DB' : 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)',
                color: 'white', border: 'none', borderRadius: '12px',
                cursor: submitting ? 'not-allowed' : 'pointer',
                boxShadow: submitting ? 'none' : '0 8px 20px rgba(26, 157, 157, 0.15)',
                marginBottom: '15px',
              }}>
                {submitting ? 'Submitting...' : 'Submit Application'}
              </button>
              <button type="button" onClick={() => onNavigate('home')} style={{
                width: '100%', padding: '14px', fontSize: '16px', fontWeight: '600',
                backgroundColor: '#F5F5F5', color: '#4B5563', border: 'none', borderRadius: '12px', cursor: 'pointer',
              }}>
                Cancel
              </button>
            </form>
          </div>
        </div>
      </section>

      <style>{`
        input:focus, select:focus { outline: none; border-color: #1A9D9D !important; box-shadow: 0 0 0 4px rgba(26, 157, 157, 0.1); }
        button:hover:not(:disabled) { transform: translateY(-2px); }
      `}</style>
    </div>
  );
}
