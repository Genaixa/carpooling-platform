import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Input, Select } from '../components/Input';
import Button from '../components/Button';
import TravelStatusBadge from '../components/TravelStatusBadge';
import { TRAVEL_STATUS_OPTIONS, GENDER_OPTIONS } from '../lib/constants';

interface ProfileProps {
  onNavigate: (page: 'home' | 'login' | 'register' | 'profile') => void;
}

export default function Profile({ onNavigate }: ProfileProps) {
  const { profile, updateProfile, user } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    gender: '' as 'Male' | 'Female' | 'Prefer not to say' | '',
    travel_status: 'solo' as 'solo' | 'couple',
    partner_name: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name,
        phone: profile.phone || '',
        gender: profile.gender || '',
        travel_status: profile.travel_status,
        partner_name: profile.partner_name || '',
      });
    }
  }, [profile]);

  useEffect(() => {
    if (!user) {
      onNavigate('login');
    }
  }, [user, onNavigate]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      setError('Name is required');
      return false;
    }

    if (!formData.phone.trim()) {
      setError('Phone number is required');
      return false;
    }

    if (!formData.gender) {
      setError('Gender is required');
      return false;
    }

    if (formData.travel_status === 'couple' && !formData.partner_name.trim()) {
      setError('Partner name is required for couples');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      await updateProfile({
        name: formData.name,
        phone: formData.phone,
        gender: formData.gender as 'Male' | 'Female' | 'Prefer not to say',
        travel_status: formData.travel_status,
        partner_name:
          formData.travel_status === 'couple' ? formData.partner_name : null,
      });
      setSuccess('Profile updated successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="mb-6">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Your Profile
            </h2>
            <p className="text-gray-600">Manage your account information</p>
          </div>

          <div className="mb-6 flex items-center space-x-4">
            <span className="text-sm text-gray-600">Current Status:</span>
            <TravelStatusBadge
              travelStatus={profile.travel_status}
              gender={profile.gender}
              partnerName={profile.partner_name}
            />
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <Input
                label="Email (cannot be changed)"
                type="email"
                value={profile.email}
                disabled
                className="bg-gray-100"
              />

              <Input
                label="Full Name"
                name="name"
                type="text"
                value={formData.name}
                onChange={handleChange}
                required
              />

              <Input
                label="Phone Number"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleChange}
                required
              />

              <Select
                label="Gender"
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                options={GENDER_OPTIONS.map((opt) => ({
                  value: opt.value,
                  label: opt.label,
                }))}
                required
              />

              <Select
                label="Travel Status"
                name="travel_status"
                value={formData.travel_status}
                onChange={handleChange}
                options={TRAVEL_STATUS_OPTIONS.map((opt) => ({
                  value: opt.value,
                  label: opt.label,
                }))}
                required
              />

              {formData.travel_status === 'couple' && (
                <Input
                  label="Partner Name (Required for Couples)"
                  name="partner_name"
                  type="text"
                  value={formData.partner_name}
                  onChange={handleChange}
                  placeholder="Enter your partner's name"
                  required
                />
              )}
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {success && (
              <div className="rounded-md bg-green-50 p-4">
                <p className="text-sm text-green-800">{success}</p>
              </div>
            )}

            <div className="flex flex-col space-y-3">
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Updating...' : 'Update Profile'}
              </Button>

              <Button
                type="button"
                variant="secondary"
                onClick={() => onNavigate('home')}
                className="w-full"
              >
                Back to Home
              </Button>
            </div>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Travel Status Compatibility
            </h3>
            <div className="space-y-2 text-sm text-gray-600">
              <p>
                <span className="font-medium">Couples:</span> Can see and book
                all rides
              </p>
              <p>
                <span className="font-medium">Solo Male:</span> Can see rides
                from Solo Male and Couple drivers
              </p>
              <p>
                <span className="font-medium">Solo Female:</span> Can see rides
                from Solo Female and Couple drivers
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
