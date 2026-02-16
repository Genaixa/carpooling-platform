import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

import Avatar from '../components/Avatar';
import toast from 'react-hot-toast';
import type { NavigateFn } from '../lib/types';

interface ProfileProps {
  onNavigate: NavigateFn;
}

export default function Profile({ onNavigate }: ProfileProps) {
  const { profile, updateProfile, user } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address_line1: '',
    address_line2: '',
    city: '',
    postcode: '',
    country: '',
    gender: 'Male' as 'Male' | 'Female',
  });
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name,
        phone: profile.phone || '',
        address_line1: profile.address_line1 || '',
        address_line2: profile.address_line2 || '',
        city: profile.city || '',
        postcode: profile.postcode || '',
        country: profile.country || '',
        gender: (profile.gender || 'Male') as 'Male' | 'Female',
      });
      setPhotoPreview(profile.profile_photo_url || null);
    }
  }, [profile]);

  useEffect(() => {
    if (!user) onNavigate('login');
  }, [user, onNavigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      setError('Please upload a JPG or PNG image only');
      return;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('Image size must be less than 5MB');
      return;
    }

    setError('');
    setSelectedFile(file);

    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handlePhotoUpload = async () => {
    if (!selectedFile || !user) {
      setError('Please select an image to upload');
      return;
    }

    setUploadingPhoto(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('photo', selectedFile);
      formData.append('userId', user.id);

      const API_URL = import.meta.env.VITE_API_URL || (window.location.protocol === 'https:' ? '' : 'http://srv1291941.hstgr.cloud:3001');
      const response = await fetch(`${API_URL}/api/upload-profile-photo`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Upload failed');

      await updateProfile({ profile_photo_url: result.url });
      toast.success('Profile photo updated!');
      setSelectedFile(null);
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (err: any) {
      setError(err.message || 'Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const validateForm = (): boolean => {
    if (!formData.name.trim()) { setError('Name is required'); return false; }
    if (!formData.phone.trim()) { setError('Phone number is required'); return false; }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!validateForm()) return;

    setLoading(true);
    try {
      await updateProfile({
        name: formData.name,
        phone: formData.phone,
        address_line1: formData.address_line1 || null,
        address_line2: formData.address_line2 || null,
        city: formData.city || null,
        postcode: formData.postcode || null,
        country: formData.country || null,
        gender: formData.gender,
        travel_status: 'solo',
      });
      toast.success('Profile updated successfully!');
      setSuccess('Profile updated successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (hasError?: boolean) => ({
    width: '100%',
    padding: '14px 16px',
    fontSize: '16px',
    border: hasError ? '2px solid #ef4444' : '2px solid #E5E7EB',
    borderRadius: '12px',
    outline: 'none',
    transition: 'border-color 0.3s',
    color: '#111827',
    fontWeight: '500' as const,
    backgroundColor: 'white',
  });

  const labelStyle = {
    display: 'block',
    fontSize: '14px',
    fontWeight: '600' as const,
    color: '#1F2937',
    marginBottom: '8px',
  };

  if (!profile) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#4B5563' }}>Loading profile...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFB' }}>
      {/* Page Header */}
      <div style={{ background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)', padding: '40px 20px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
          <h1 style={{ fontSize: '42px', fontWeight: 'bold', color: 'white', marginBottom: '10px', textShadow: '2px 2px 4px rgba(0,0,0,0.2)' }}>
            Your Profile
          </h1>
          <p style={{ fontSize: '18px', color: 'rgba(255, 255, 255, 0.95)', margin: 0 }}>
            Manage your account information
          </p>
        </div>
      </div>

      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px' }}>
        {/* Profile Photo Card */}
        <div style={{
          backgroundColor: 'white', borderRadius: '20px', padding: '32px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.06)', marginBottom: '24px',
        }}>
          <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1F2937', marginBottom: '24px' }}>
            Profile Photo
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
            <Avatar
              photoUrl={photoPreview || profile.profile_photo_url}
              name={profile.name}
              size="lg"
            />
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={labelStyle}>Upload Photo (JPG/PNG, max 5MB)</label>
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                onChange={handleFileChange}
                disabled={uploadingPhoto}
                style={{
                  fontSize: '14px', color: '#4B5563', marginBottom: '12px',
                  display: 'block', width: '100%',
                }}
              />
              {selectedFile && (
                <button
                  onClick={handlePhotoUpload}
                  disabled={uploadingPhoto}
                  style={{
                    padding: '10px 24px',
                    background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)',
                    color: 'white', borderRadius: '50px', fontSize: '14px',
                    fontWeight: '600', border: 'none', cursor: 'pointer',
                    opacity: uploadingPhoto ? 0.7 : 1,
                  }}
                >
                  {uploadingPhoto ? 'Uploading...' : 'Upload Photo'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Profile Form Card */}
        <div style={{
          backgroundColor: 'white', borderRadius: '20px', padding: '32px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.06)', marginBottom: '24px',
        }}>
          <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1F2937', marginBottom: '24px' }}>
            Account Details
          </h3>

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Email (read-only) */}
              <div>
                <label style={labelStyle}>Email (cannot be changed)</label>
                <input
                  type="email"
                  value={profile.email}
                  disabled
                  style={{ ...inputStyle(), backgroundColor: '#F9FAFB', color: '#6B7280' }}
                />
              </div>

              {/* Name + Phone row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Full Name *</label>
                  <input
                    name="name"
                    type="text"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    style={inputStyle()}
                    onFocus={(e) => e.target.style.borderColor = '#1A9D9D'}
                    onBlur={(e) => e.target.style.borderColor = '#E5E7EB'}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Phone Number *</label>
                  <input
                    name="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                    style={inputStyle()}
                    onFocus={(e) => e.target.style.borderColor = '#1A9D9D'}
                    onBlur={(e) => e.target.style.borderColor = '#E5E7EB'}
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <label style={labelStyle}>Address Line 1</label>
                <input
                  name="address_line1"
                  type="text"
                  value={formData.address_line1}
                  onChange={handleChange}
                  placeholder="123 High Street"
                  style={inputStyle()}
                  onFocus={(e) => e.target.style.borderColor = '#1A9D9D'}
                  onBlur={(e) => e.target.style.borderColor = '#E5E7EB'}
                />
              </div>
              <div>
                <label style={labelStyle}>Address Line 2</label>
                <input
                  name="address_line2"
                  type="text"
                  value={formData.address_line2}
                  onChange={handleChange}
                  placeholder="Flat 4, Building Name (optional)"
                  style={inputStyle()}
                  onFocus={(e) => e.target.style.borderColor = '#1A9D9D'}
                  onBlur={(e) => e.target.style.borderColor = '#E5E7EB'}
                />
              </div>
              <div>
                <label style={labelStyle}>City / Town</label>
                <input
                  name="city"
                  type="text"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="London"
                  style={inputStyle()}
                  onFocus={(e) => e.target.style.borderColor = '#1A9D9D'}
                  onBlur={(e) => e.target.style.borderColor = '#E5E7EB'}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Postcode</label>
                  <input
                    name="postcode"
                    type="text"
                    value={formData.postcode}
                    onChange={handleChange}
                    placeholder="SW1A 1AA"
                    style={inputStyle()}
                    onFocus={(e) => e.target.style.borderColor = '#1A9D9D'}
                    onBlur={(e) => e.target.style.borderColor = '#E5E7EB'}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Country</label>
                  <input
                    name="country"
                    type="text"
                    value={formData.country}
                    onChange={handleChange}
                    placeholder="United Kingdom"
                    style={inputStyle()}
                    onFocus={(e) => e.target.style.borderColor = '#1A9D9D'}
                    onBlur={(e) => e.target.style.borderColor = '#E5E7EB'}
                  />
                </div>
              </div>

              {/* Gender */}
              <div>
                <label style={labelStyle}>Gender *</label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  required
                  style={{
                    ...inputStyle(),
                    appearance: 'none',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%231F2937' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 16px center',
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#1A9D9D'}
                  onBlur={(e) => e.target.style.borderColor = '#E5E7EB'}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>

              {/* Error / Success */}
              {error && (
                <div style={{
                  padding: '14px 20px', borderRadius: '12px',
                  backgroundColor: '#fee2e2', border: '1px solid #fca5a5',
                }}>
                  <p style={{ fontSize: '14px', color: '#991b1b', margin: 0, fontWeight: '500' }}>{error}</p>
                </div>
              )}

              {success && (
                <div style={{
                  padding: '14px 20px', borderRadius: '12px',
                  backgroundColor: '#dcfce7', border: '1px solid #86efac',
                }}>
                  <p style={{ fontSize: '14px', color: '#166534', margin: 0, fontWeight: '500' }}>{success}</p>
                </div>
              )}

              {/* Buttons */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    flex: 1, padding: '14px',
                    background: loading ? '#9CA3AF' : 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)',
                    color: 'white', borderRadius: '50px', fontSize: '16px',
                    fontWeight: '700', border: 'none',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    boxShadow: loading ? 'none' : '0 4px 12px rgba(26,157,157,0.25)',
                    transition: 'all 0.3s',
                  }}
                >
                  {loading ? 'Updating...' : 'Update Profile'}
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('home')}
                  style={{
                    padding: '14px 28px',
                    backgroundColor: '#F3F4F6', color: '#374151',
                    borderRadius: '50px', fontSize: '16px',
                    fontWeight: '600', border: 'none', cursor: 'pointer',
                    transition: 'all 0.3s',
                  }}
                >
                  Back
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Safety Info Card */}
        <div style={{
          backgroundColor: 'white', borderRadius: '20px', padding: '32px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
        }}>
          <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1F2937', marginBottom: '16px' }}>
            Car Composition Safety
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <p style={{ fontSize: '14px', color: '#4B5563', margin: 0 }}>
              <span style={{ fontWeight: '600', color: '#1F2937' }}>Female passengers:</span> Can book rides with at least 1 woman or 1 couple in the car
            </p>
            <p style={{ fontSize: '14px', color: '#4B5563', margin: 0 }}>
              <span style={{ fontWeight: '600', color: '#1F2937' }}>Male passengers:</span> Can book rides with at least 1 man or 1 couple in the car
            </p>
            <p style={{ fontSize: '14px', color: '#4B5563', margin: 0 }}>
              Drivers specify who is in their car when posting a ride. Your gender helps us show you compatible rides.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
