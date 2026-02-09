import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { AGE_GROUP_OPTIONS, GENDER_OPTIONS } from '../lib/constants';
import type { NavigateFn } from '../lib/types';
import toast from 'react-hot-toast';

interface DriverApplicationProps {
  onNavigate: NavigateFn;
}

export default function DriverApplication({ onNavigate }: DriverApplicationProps) {
  const { user, profile, loading: authLoading } = useAuth();
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
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!authLoading && !user) {
      onNavigate('login');
    }
  }, [user, authLoading, onNavigate]);

  useEffect(() => {
    if (user) loadExistingApplication();
  }, [user]);

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

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.first_name.trim()) newErrors.first_name = 'First name is required';
    if (!formData.surname.trim()) newErrors.surname = 'Surname is required';
    if (!formData.age_group) newErrors.age_group = 'Age group is required';
    if (!formData.gender) newErrors.gender = 'Gender is required';
    if (!formData.has_drivers_license) newErrors.has_drivers_license = 'You must have a valid driving licence';
    if (!formData.car_insured) newErrors.car_insured = 'Your car must be insured';
    if (!formData.has_mot) newErrors.has_mot = 'Your car must have a valid MOT';
    if (!formData.car_make.trim()) newErrors.car_make = 'Car make is required';
    if (!formData.car_model.trim()) newErrors.car_model = 'Car model is required';
    if (!formData.years_driving_experience) newErrors.years_driving_experience = 'Years of experience is required';
    if (!formData.dbs_check_acknowledged) newErrors.dbs_check_acknowledged = 'You must acknowledge the DBS check requirement';
    if (!formData.emergency_contact_name.trim()) newErrors.emergency_contact_name = 'Emergency contact name is required';
    if (!formData.emergency_contact_phone.trim()) newErrors.emergency_contact_phone = 'Emergency contact phone is required';
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
        status: 'pending',
      }]);

      if (error) throw error;
      toast.success('Application submitted successfully! We will review it shortly.');
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
        <nav style={{ backgroundColor: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '90px', gap: '60px' }}>
              <div style={{ cursor: 'pointer' }} onClick={() => onNavigate('home')}>
                <img src="/ChapaRideLogo.jpg" alt="ChapaRide Logo" style={{ height: '75px', width: 'auto', objectFit: 'contain' }} />
              </div>
            </div>
          </div>
        </nav>
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

  if (existingApplication) {
    const statusColors: Record<string, { bg: string; color: string; border: string }> = {
      pending: { bg: '#fef3c7', color: '#92400e', border: '#fde047' },
      approved: { bg: '#dcfce7', color: '#166534', border: '#86efac' },
      rejected: { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
    };
    const sc = statusColors[existingApplication.status] || statusColors.pending;

    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFB' }}>
        <nav style={{ backgroundColor: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '90px', gap: '60px' }}>
              <div style={{ cursor: 'pointer' }} onClick={() => onNavigate('home')}>
                <img src="/ChapaRideLogo.jpg" alt="ChapaRide Logo" style={{ height: '75px', width: 'auto', objectFit: 'contain' }} />
              </div>
            </div>
          </div>
        </nav>
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

  const inputStyle = (field: string) => ({
    width: '100%', padding: '14px', fontSize: '16px',
    border: errors[field] ? '2px solid #ef4444' : '2px solid #E8EBED',
    borderRadius: '12px', transition: 'border-color 0.3s',
  });

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFB' }}>
      <nav style={{ backgroundColor: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '90px', gap: '60px' }}>
            <div style={{ cursor: 'pointer' }} onClick={() => onNavigate('home')}>
              <img src="/ChapaRideLogo.jpg" alt="ChapaRide Logo" style={{ height: '75px', width: 'auto', objectFit: 'contain' }} />
            </div>
          </div>
        </div>
      </nav>

      <section style={{ background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)', padding: '60px 20px', minHeight: 'calc(100vh - 90px)' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h1 style={{ fontSize: '48px', fontWeight: 'bold', color: 'white', marginBottom: '15px', textShadow: '2px 2px 4px rgba(0,0,0,0.2)' }}>Become a Driver</h1>
            <p style={{ fontSize: '20px', color: 'rgba(255, 255, 255, 0.95)' }}>Complete this application to start offering rides</p>
          </div>

          <div style={{ backgroundColor: 'white', borderRadius: '24px', padding: '40px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <form onSubmit={handleSubmit}>
              {/* Personal Details */}
              <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#1F2937', marginBottom: '20px' }}>Personal Details</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>Car Make *</label>
                  <input name="car_make" type="text" value={formData.car_make} onChange={handleChange} placeholder="e.g., Toyota" style={inputStyle('car_make')} />
                  {errors.car_make && <p style={{ color: '#ef4444', fontSize: '14px', marginTop: '4px' }}>{errors.car_make}</p>}
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>Car Model *</label>
                  <input name="car_model" type="text" value={formData.car_model} onChange={handleChange} placeholder="e.g., Corolla" style={inputStyle('car_model')} />
                  {errors.car_model && <p style={{ color: '#ef4444', fontSize: '14px', marginTop: '4px' }}>{errors.car_model}</p>}
                </div>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>Years of Driving Experience *</label>
                <input name="years_driving_experience" type="number" min="0" value={formData.years_driving_experience} onChange={handleChange} style={{ ...inputStyle('years_driving_experience'), maxWidth: '200px' }} />
                {errors.years_driving_experience && <p style={{ color: '#ef4444', fontSize: '14px', marginTop: '4px' }}>{errors.years_driving_experience}</p>}
              </div>

              {/* Compliance Checks */}
              <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#1F2937', marginBottom: '20px', marginTop: '30px' }}>Compliance</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
                {[
                  { name: 'has_drivers_license', label: 'I have a valid UK driving licence' },
                  { name: 'car_insured', label: 'My car is fully insured' },
                  { name: 'has_mot', label: 'My car has a valid MOT certificate' },
                  { name: 'dbs_check_acknowledged', label: 'I acknowledge that a DBS check may be required' },
                ].map(({ name, label }) => (
                  <label key={name} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                    <input type="checkbox" name={name} checked={(formData as any)[name]} onChange={handleChange} style={{ width: '20px', height: '20px', accentColor: '#1A9D9D' }} />
                    <span style={{ fontSize: '14px', color: '#1F2937' }}>{label} *</span>
                  </label>
                ))}
                {(errors.has_drivers_license || errors.car_insured || errors.has_mot || errors.dbs_check_acknowledged) && (
                  <p style={{ color: '#ef4444', fontSize: '14px' }}>All compliance checks must be confirmed</p>
                )}
              </div>

              {/* Emergency Contact */}
              <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#1F2937', marginBottom: '20px', marginTop: '30px' }}>Emergency Contact</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
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
