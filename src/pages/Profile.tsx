import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

import Avatar from '../components/Avatar';
import StarRating from '../components/StarRating';
import toast from 'react-hot-toast';
import type { NavigateFn } from '../lib/types';

interface ProfileProps {
  onNavigate: NavigateFn;
}

const API_URL = import.meta.env.VITE_API_URL || '';

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
    marital_status: '' as string,
  });
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [licenceUploading, setLicenceUploading] = useState(false);
  const [notifyDriverAlerts, setNotifyDriverAlerts] = useState(true);
  const [myReviews, setMyReviews] = useState<Array<{ id: string; rating: number; comment: string | null; type: string; created_at: string }>>([]);

  useEffect(() => {
    if (user) {
      supabase
        .from('reviews')
        .select('id, rating, comment, type, created_at')
        .eq('reviewee_id', user.id)
        .order('created_at', { ascending: false })
        .then(({ data }) => setMyReviews(data || []));
    }
  }, [user]);

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
        marital_status: profile.marital_status || '',
      });
      setPhotoPreview(profile.profile_photo_url || null);
      setNotifyDriverAlerts(profile.notify_driver_alerts !== false);
    }
  }, [profile]);

  const handleToggleNotifyAlerts = async (checked: boolean) => {
    setNotifyDriverAlerts(checked);
    try {
      await updateProfile({ notify_driver_alerts: checked });
      toast.success(checked ? 'Alert emails enabled' : 'Alert emails disabled');
    } catch {
      setNotifyDriverAlerts(!checked);
      toast.error('Failed to update preference');
    }
  };

  useEffect(() => {
    if (!user) {
      sessionStorage.setItem('loginRedirect', 'profile');
      onNavigate('login');
    }
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

      const { data: { session } } = await supabase.auth.getSession();
      const API_URL = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${API_URL}/api/upload-profile-photo`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` },
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
        marital_status: (formData.marital_status as 'Single' | 'Married') || null,
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

  const handleLicenceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files?.length) return;
    const file = e.target.files[0];
    if (!['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'].includes(file.type)) {
      toast.error('Only JPG, PNG, or PDF files are allowed');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File must be under 5MB');
      return;
    }
    setLicenceUploading(true);
    try {
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('userId', user.id);
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_URL}/api/upload-licence-photo`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` },
        body: formData,
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success('Licence photo uploaded! It will be reviewed by an admin.');
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload licence photo');
    } finally {
      setLicenceUploading(false);
    }
  };

  const viewLicencePhoto = async () => {
    if (!user) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_URL}/api/licence-photo-url?targetUserId=${user.id}&requesterId=${user.id}`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` },
      });
      if (!res.ok) throw new Error('Failed to get URL');
      const { url } = await res.json();
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      toast.error('Could not open licence photo. Please try again.');
    }
  };

  const handleDeleteLicencePhoto = async () => {
    if (!user || !confirm('Are you sure you want to delete your licence photo? This will remove your Gold Driver status.')) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_URL}/api/delete-licence-photo`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success('Licence photo deleted');
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete licence photo');
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
      <div style={{ background: '#fcd03a', padding: '40px 20px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
          <h1 style={{ fontSize: '42px', fontWeight: 'bold', color: '#000000', marginBottom: '10px' }}>
            Your Profile
          </h1>
          <p style={{ fontSize: '18px', color: 'rgba(0,0,0,0.7)', margin: 0 }}>
            Manage your account information
          </p>
        </div>
      </div>

      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px' }}>
        {/* Profile Photo + Licence row */}
        <div style={{ display: 'flex', gap: '24px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {/* Profile Photo Card */}
          <div style={{
            flex: 1, minWidth: '280px', backgroundColor: 'white', borderRadius: '20px', padding: '32px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
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
              <div style={{ flex: 1, minWidth: '160px' }}>
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
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {selectedFile && (
                    <button
                      onClick={handlePhotoUpload}
                      disabled={uploadingPhoto}
                      style={{
                        padding: '10px 24px', background: '#000000',
                        color: '#fcd03a', borderRadius: '50px', fontSize: '14px',
                        fontWeight: '600', border: 'none', cursor: 'pointer',
                        opacity: uploadingPhoto ? 0.7 : 1,
                      }}
                    >
                      {uploadingPhoto ? 'Uploading...' : 'Upload Photo'}
                    </button>
                  )}
                  {(photoPreview || profile.profile_photo_url) && !selectedFile && (
                    <button
                      onClick={async () => {
                        await updateProfile({ profile_photo_url: null });
                        setPhotoPreview(null);
                        toast.success('Profile photo removed');
                      }}
                      style={{
                        padding: '10px 24px', backgroundColor: '#FEE2E2', color: '#991B1B',
                        borderRadius: '50px', fontSize: '14px', fontWeight: '600',
                        border: '1px solid #FCA5A5', cursor: 'pointer',
                      }}
                    >
                      Remove Photo
                    </button>
                  )}
                </div>
                <p style={{
                  marginTop: '12px', fontSize: '12px', color: '#6B7280',
                  display: 'flex', alignItems: 'flex-start', gap: '6px', lineHeight: '1.5',
                }}>
                  <span style={{ fontSize: '14px', flexShrink: 0 }}>🔒</span>
                  <span>Your profile picture is <strong>not visible to other users</strong>. It is an optional personalisation feature.</span>
                </p>
              </div>
            </div>
          </div>

          {/* Licence Card — only for approved drivers */}
          {profile.is_approved_driver && (
            <div style={{
              flex: 1, minWidth: '280px', backgroundColor: 'white', borderRadius: '20px', padding: '32px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.06)', borderLeft: '5px solid #fde047',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', padding: '4px 12px',
                  borderRadius: '20px', fontSize: '13px', fontWeight: '700',
                  backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fde047',
                }}>Gold Driver</span>
                <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1F2937', margin: 0 }}>
                  {profile.driver_tier === 'gold' ? 'Verified' : 'Upgrade to Gold'}
                </h3>
              </div>

              {profile.driver_tier !== 'gold' && (
                <p style={{ color: '#4B5563', fontSize: '14px', marginBottom: '16px' }}>
                  Upload a photo of your driving licence to become a Gold Driver and get a special badge on your rides.
                </p>
              )}

              {/* No upload yet */}
              {!profile.licence_status && (
                <div>
                  <label style={{
                    display: 'inline-block', padding: '12px 24px',
                    background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
                    color: 'white', borderRadius: '12px', fontSize: '14px', fontWeight: '600',
                    cursor: licenceUploading ? 'not-allowed' : 'pointer',
                    opacity: licenceUploading ? 0.6 : 1,
                  }}>
                    {licenceUploading ? 'Uploading...' : 'Upload Licence Photo'}
                    <input type="file" accept="image/jpeg,image/png,application/pdf" onChange={handleLicenceUpload} disabled={licenceUploading} style={{ display: 'none' }} />
                  </label>
                  <p style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '8px' }}>JPG, PNG, or PDF, max 5MB</p>
                </div>
              )}

              {/* Pending */}
              {profile.licence_status === 'pending' && (
                <div>
                  {profile.licence_photo_url && (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ position: 'relative', display: 'inline-block' }}>
                        <button onClick={viewLicencePhoto} style={{
                          display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px',
                          border: '2px solid #fde047', borderRadius: '10px', cursor: 'pointer',
                          color: '#92400e', fontSize: '14px', fontWeight: '600', backgroundColor: '#fef9e0',
                        }}>
                          View Uploaded Licence
                        </button>
                        <button onClick={handleDeleteLicencePhoto} title="Delete licence photo" style={{
                          position: 'absolute', top: '-8px', right: '-8px', width: '26px', height: '26px',
                          borderRadius: '50%', backgroundColor: '#ef4444', color: 'white', border: '2px solid white',
                          cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          padding: 0, boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                        }}>×</button>
                      </div>
                    </div>
                  )}
                  <div style={{ padding: '12px 16px', backgroundColor: '#fef3c7', borderRadius: '10px', border: '1px solid #fde047' }}>
                    <p style={{ fontSize: '14px', color: '#92400e', fontWeight: '600', margin: 0 }}>
                      Under review — we'll update your status soon.
                    </p>
                  </div>
                </div>
              )}

              {/* Rejected */}
              {profile.licence_status === 'rejected' && (
                <div>
                  {profile.licence_photo_url && (
                    <div style={{ marginBottom: '12px' }}>
                      <button onClick={viewLicencePhoto} style={{
                        display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 16px',
                        border: '2px solid #fca5a5', borderRadius: '10px', cursor: 'pointer',
                        color: '#991b1b', fontSize: '14px', fontWeight: '600', backgroundColor: '#fee2e2', opacity: 0.8,
                      }}>
                        View Previous Upload
                      </button>
                    </div>
                  )}
                  <div style={{ padding: '12px 16px', backgroundColor: '#fee2e2', borderRadius: '10px', border: '1px solid #fca5a5', marginBottom: '12px' }}>
                    <p style={{ fontSize: '14px', color: '#991b1b', fontWeight: '600', margin: 0 }}>
                      Not approved — please re-upload.
                    </p>
                  </div>
                  <label style={{
                    display: 'inline-block', padding: '12px 24px',
                    background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
                    color: 'white', borderRadius: '12px', fontSize: '14px', fontWeight: '600',
                    cursor: licenceUploading ? 'not-allowed' : 'pointer',
                    opacity: licenceUploading ? 0.6 : 1,
                  }}>
                    {licenceUploading ? 'Uploading...' : 'Re-upload Licence Photo'}
                    <input type="file" accept="image/jpeg,image/png,application/pdf" onChange={handleLicenceUpload} disabled={licenceUploading} style={{ display: 'none' }} />
                  </label>
                </div>
              )}

              {/* Gold — verified */}
              {profile.driver_tier === 'gold' && (
                <div>
                  <p style={{ fontSize: '14px', color: '#92400e', fontWeight: '500', marginBottom: '12px' }}>
                    Your licence has been verified. You're a Gold Driver!
                  </p>
                  {profile.licence_photo_url && (
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <button onClick={viewLicencePhoto} style={{
                        display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px',
                        border: '2px solid #fde047', borderRadius: '10px', cursor: 'pointer',
                        color: '#92400e', fontSize: '14px', fontWeight: '600', backgroundColor: '#fef9e0',
                      }}>
                        View Verified Licence
                      </button>
                      <button onClick={handleDeleteLicencePhoto} title="Delete licence photo (will remove Gold status)" style={{
                        position: 'absolute', top: '-8px', right: '-8px', width: '26px', height: '26px',
                        borderRadius: '50%', backgroundColor: '#ef4444', color: 'white', border: '2px solid white',
                        cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: 0, boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                      }}>×</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
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
                    onFocus={(e) => e.target.style.borderColor = '#fcd03a'}
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
                    onFocus={(e) => e.target.style.borderColor = '#fcd03a'}
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
                  onFocus={(e) => e.target.style.borderColor = '#fcd03a'}
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
                  onFocus={(e) => e.target.style.borderColor = '#fcd03a'}
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
                  onFocus={(e) => e.target.style.borderColor = '#fcd03a'}
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
                    onFocus={(e) => e.target.style.borderColor = '#fcd03a'}
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
                    onFocus={(e) => e.target.style.borderColor = '#fcd03a'}
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
                  onFocus={(e) => e.target.style.borderColor = '#fcd03a'}
                  onBlur={(e) => e.target.style.borderColor = '#E5E7EB'}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>

              {/* Marital Status */}
              <div>
                <label style={labelStyle}>Marital Status</label>
                <select
                  name="marital_status"
                  value={formData.marital_status}
                  onChange={handleChange}
                  style={{
                    ...inputStyle(),
                    appearance: 'none',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%231F2937' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 16px center',
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#fcd03a'}
                  onBlur={(e) => e.target.style.borderColor = '#E5E7EB'}
                >
                  <option value="">Select marital status</option>
                  <option value="Single">Single</option>
                  <option value="Married">Married</option>
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
                  backgroundColor: '#fef9e0', border: '1px solid #fcd03a',
                }}>
                  <p style={{ fontSize: '14px', color: '#000000', margin: 0, fontWeight: '500' }}>{success}</p>
                </div>
              )}

              {/* Buttons */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    flex: 1, padding: '14px',
                    background: loading ? '#9CA3AF' : '#000000',
                    color: loading ? '#ffffff' : '#fcd03a', borderRadius: '50px', fontSize: '16px',
                    fontWeight: '700', border: 'none',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    boxShadow: loading ? 'none' : '0 4px 12px rgba(252,208,58,0.3)',
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

        {/* Driver Alert Notifications — approved drivers only */}
        {/* Passenger Alert Notifications — hidden while feature is paused
        {profile.is_approved_driver && (
          <div style={{
            backgroundColor: 'white', borderRadius: '20px', padding: '32px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.06)', marginBottom: '24px',
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1F2937', marginBottom: '8px' }}>
              Passenger Alert Notifications
            </h3>
            <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '20px', margin: '0 0 20px 0' }}>
              Get notified by email when passengers in your city create a ride alert.
            </p>
            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', backgroundColor: '#fef9e0', border: '2px solid #fcd03a', borderRadius: '12px', padding: '16px 20px', boxShadow: '0 2px 8px rgba(252,208,58,0.2)' }}>
              <input
                type="checkbox"
                checked={notifyDriverAlerts}
                onChange={(e) => handleToggleNotifyAlerts(e.target.checked)}
                style={{ width: '20px', height: '20px', accentColor: '#fcd03a', cursor: 'pointer', flexShrink: 0 }}
              />
              <span style={{ fontSize: '15px', fontWeight: '700', color: '#1F2937' }}>
                Email me when passengers in my city create alerts
              </span>
            </label>
          </div>
        )}
        */}

        {/* My Reviews */}
        <div style={{
          backgroundColor: 'white', borderRadius: '20px', padding: '32px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.06)', marginBottom: '24px',
        }}>
          <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1F2937', marginBottom: '16px' }}>
            My Reviews
          </h3>
          {myReviews.length === 0 ? (
            <p style={{ fontSize: '14px', color: '#9CA3AF', margin: 0 }}>No reviews received yet.</p>
          ) : (
            <>
              {/* Summary */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', padding: '16px 20px', backgroundColor: '#fef9e0', border: '2px solid #fcd03a', borderRadius: '12px' }}>
                <StarRating rating={profile?.average_rating || 0} size="lg" />
                <span style={{ fontSize: '24px', fontWeight: '800', color: '#1F2937' }}>
                  {profile?.average_rating?.toFixed(1) || '—'}
                </span>
                <span style={{ fontSize: '14px', color: '#6B7280' }}>
                  from {myReviews.length} review{myReviews.length !== 1 ? 's' : ''}
                </span>
              </div>
              {/* Individual reviews */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {myReviews.map((review) => (
                  <div key={review.id} style={{ padding: '14px 16px', backgroundColor: '#F8FAFB', borderRadius: '12px', borderLeft: '4px solid #fcd03a' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: review.comment ? '8px' : '0' }}>
                      <StarRating rating={review.rating} size="sm" />
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#6B7280', textTransform: 'capitalize' }}>
                        {review.type === 'driver-to-passenger' ? 'Review as passenger' : 'Review as driver'}
                      </span>
                      <span style={{ fontSize: '12px', color: '#9CA3AF', marginLeft: 'auto' }}>
                        {new Date(review.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    {review.comment && (
                      <p style={{ margin: 0, fontSize: '14px', color: '#4B5563', fontStyle: 'italic' }}>
                        "{review.comment}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
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
