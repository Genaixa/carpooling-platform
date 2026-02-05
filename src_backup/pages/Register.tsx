import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Input, Select } from '../components/Input';
import Button from '../components/Button';
import { TRAVEL_STATUS_OPTIONS, GENDER_OPTIONS } from '../lib/constants';

interface RegisterProps {
  onNavigate: (page: 'home' | 'login' | 'register' | 'profile' | 'post-ride' | 'dashboard' | 'edit-ride' | 'ride-details' | 'my-bookings' | 'profile-edit' | 'public-profile', rideId?: string, userId?: string) => void;
}

export default function Register({ onNavigate }: RegisterProps) {
  const { signUp } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    phone: '',
    gender: '' as 'Male' | 'Female' | 'Prefer not to say' | '',
    travel_status: 'solo' as 'solo' | 'couple',
    partner_name: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return false;
    }

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

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      await signUp(formData.email, formData.password, {
        name: formData.name,
        phone: formData.phone,
        gender: formData.gender as 'Male' | 'Female' | 'Prefer not to say',
        travel_status: formData.travel_status,
        partner_name:
          formData.travel_status === 'couple' ? formData.partner_name : null,
      });
      onNavigate('home');
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="text-center text-3xl font-bold text-gray-900">
            Create your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Already have an account?{' '}
            <button
              onClick={() => onNavigate('login')}
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              Sign in
            </button>
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <Input
              label="Full Name"
              name="name"
              type="text"
              value={formData.name}
              onChange={handleChange}
              required
            />

            <Input
              label="Email address"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              required
              autoComplete="email"
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

            <Input
              label="Password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              required
              autoComplete="new-password"
            />

            <Input
              label="Confirm Password"
              name="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              autoComplete="new-password"
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="flex flex-col space-y-3">
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Creating account...' : 'Create account'}
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
      </div>
    </div>
  );
}
