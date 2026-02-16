import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Input, Select, TextArea } from '../components/Input';
import Button from '../components/Button';
import Loading from '../components/Loading';
import ErrorAlert from '../components/ErrorAlert';
import type { NavigateFn } from '../lib/types';

interface EditProfileProps {
  onNavigate: NavigateFn;
}

export default function EditProfile({ onNavigate }: EditProfileProps) {
  const { user, profile, updateProfile, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [driverDetailsOpen, setDriverDetailsOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address_line1: '',
    address_line2: '',
    city: '',
    postcode: '',
    country: '',
    email: '',
    bio: '',
    gender: 'Male' as 'Male' | 'Female',
    vehicle_make: '',
    vehicle_model: '',
    vehicle_color: '',
    vehicle_registration: '',
    vehicle_year: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      onNavigate('login');
    }
  }, [user, authLoading, onNavigate]);

  // Load profile data
  useEffect(() => {
    if (profile && user) {
      setFormData({
        name: profile.name || '',
        phone: profile.phone || '',
        address_line1: profile.address_line1 || '',
        address_line2: profile.address_line2 || '',
        city: profile.city || '',
        postcode: profile.postcode || '',
        country: profile.country || '',
        email: profile.email || '',
        bio: (profile as any).bio || '',
        gender: (profile.gender || 'Male') as 'Male' | 'Female',
        vehicle_make: (profile as any).vehicle_make || '',
        vehicle_model: (profile as any).vehicle_model || '',
        vehicle_color: (profile as any).vehicle_color || '',
        vehicle_registration: (profile as any).vehicle_registration || '',
        vehicle_year: (profile as any).vehicle_year ? String((profile as any).vehicle_year) : '',
      });
      setLoading(false);
    }
  }, [profile, user]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Full name is required';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    }

    if (!formData.gender) {
      newErrors.gender = 'Gender is required';
    }


    if (formData.bio && formData.bio.length > 200) {
      newErrors.bio = 'Bio must be 200 characters or less';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    // ✅ DELETED: setSuccess('');

    if (!validateForm()) {
      return;
    }

    if (!user) {
      setError('You must be logged in to update your profile');
      return;
    }

    setSubmitting(true);

    try {
      const updateData: any = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        address_line1: formData.address_line1.trim() || null,
        address_line2: formData.address_line2.trim() || null,
        city: formData.city.trim() || null,
        postcode: formData.postcode.trim() || null,
        country: formData.country.trim() || null,
        travel_status: 'solo',
        gender: formData.gender,
        bio: formData.bio.trim() || null,
        vehicle_make: formData.vehicle_make.trim() || null,
        vehicle_model: formData.vehicle_model.trim() || null,
        vehicle_color: formData.vehicle_color.trim() || null,
        vehicle_registration: formData.vehicle_registration.trim() || null,
        vehicle_year: formData.vehicle_year ? parseInt(formData.vehicle_year) : null,
      };

      const { error: updateError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id);

      if (updateError) throw updateError;

      // Update the profile in context
      await updateProfile(updateData);

      toast.success('Profile updated successfully!');
      
      // Redirect to profile after a short delay to show success message
      setTimeout(() => {
        onNavigate('profile');
      }, 500);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setSubmitting(false);
    }
  };

  // Show loading or nothing if auth is loading or user is not logged in
  if (authLoading || !user || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loading message="Loading profile..." />
      </div>
    );
  }

  const bioCharCount = formData.bio.length;
  const bioMaxChars = 200;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="mb-6">
            <h2 className="text-3xl font-bold text-gray-900">Edit Profile</h2>
            <p className="mt-2 text-sm text-gray-600">
              Update your profile information
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Full Name */}
            <Input
              label="Full Name"
              name="name"
              type="text"
              value={formData.name}
              onChange={handleChange}
              required
              error={errors.name}
              placeholder="Enter your full name"
            />

            {/* Phone Number */}
            <Input
              label="Phone Number"
              name="phone"
              type="tel"
              value={formData.phone}
              onChange={handleChange}
              required
              error={errors.phone}
              placeholder="Enter your phone number"
            />

            {/* Address */}
            <Input
              label="Address Line 1"
              name="address_line1"
              type="text"
              value={formData.address_line1}
              onChange={handleChange}
              placeholder="123 High Street"
            />
            <Input
              label="Address Line 2"
              name="address_line2"
              type="text"
              value={formData.address_line2}
              onChange={handleChange}
              placeholder="Flat 4, Building Name (optional)"
            />
            <Input
              label="City / Town"
              name="city"
              type="text"
              value={formData.city}
              onChange={handleChange}
              placeholder="London"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Postcode"
                name="postcode"
                type="text"
                value={formData.postcode}
                onChange={handleChange}
                placeholder="SW1A 1AA"
              />
              <Input
                label="Country"
                name="country"
                type="text"
                value={formData.country}
                onChange={handleChange}
                placeholder="United Kingdom"
              />
            </div>

            {/* Email (disabled) */}
            <Input
              label="Email"
              name="email"
              type="email"
              value={formData.email}
              disabled
              className="bg-gray-100 cursor-not-allowed"
            />

            {/* Bio */}
            <div>
              <TextArea
                label="Bio (Optional)"
                name="bio"
                value={formData.bio}
                onChange={handleChange}
                error={errors.bio}
                placeholder="Tell us about yourself..."
                rows={4}
                maxLength={200}
              />
              <p className={`mt-1 text-sm ${bioCharCount > bioMaxChars ? 'text-red-600' : 'text-gray-500'}`}>
                {bioCharCount} / {bioMaxChars} characters
              </p>
            </div>

            {/* Gender */}
            <Select
              label="Gender"
              name="gender"
              value={formData.gender}
              onChange={handleChange}
              required
              error={errors.gender}
              options={[
                { value: 'Male', label: 'Male' },
                { value: 'Female', label: 'Female' },
              ]}
            />

            {/* Driver Details Section - Collapsible */}
            <div className="border-t pt-6">
              <button
                type="button"
                onClick={() => setDriverDetailsOpen(!driverDetailsOpen)}
                className="flex items-center justify-between w-full text-left"
              >
                <h3 className="text-lg font-semibold text-gray-900">
                  Driver Details (Optional)
                </h3>
                <svg
                  className={`w-5 h-5 text-gray-500 transition-transform ${driverDetailsOpen ? 'transform rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {driverDetailsOpen && (
                <div className="mt-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="Vehicle Make"
                      name="vehicle_make"
                      type="text"
                      value={formData.vehicle_make}
                      onChange={handleChange}
                      placeholder="e.g., Toyota"
                    />
                    <Input
                      label="Vehicle Model"
                      name="vehicle_model"
                      type="text"
                      value={formData.vehicle_model}
                      onChange={handleChange}
                      placeholder="e.g., Corolla"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="Vehicle Color"
                      name="vehicle_color"
                      type="text"
                      value={formData.vehicle_color}
                      onChange={handleChange}
                      placeholder="e.g., Blue"
                    />
                    <Input
                      label="License Plate"
                      name="vehicle_registration"
                      type="text"
                      value={formData.vehicle_registration}
                      onChange={handleChange}
                      placeholder="e.g., AB12 CDE"
                    />
                  </div>
                  <Input
                    label="Vehicle Year (Optional)"
                    name="vehicle_year"
                    type="number"
                    value={formData.vehicle_year}
                    onChange={handleChange}
                    placeholder="e.g., 2020"
                    min="1900"
                    max={new Date().getFullYear() + 1}
                  />
                </div>
              )}
            </div>

            {error && (
              <ErrorAlert message={error} />
            )}

            <div className="flex flex-col space-y-3 pt-4">
              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? 'Saving...' : 'Save Changes'}
              </Button>

              <Button
                type="button"
                variant="secondary"
                onClick={() => onNavigate('profile')}
                className="w-full"
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
