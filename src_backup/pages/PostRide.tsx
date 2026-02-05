import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Input } from '../components/Input';
import Button from '../components/Button';

interface PostRideProps {
  onNavigate: (page: 'home' | 'login' | 'register' | 'profile' | 'post-ride' | 'dashboard' | 'edit-ride' | 'ride-details' | 'my-bookings' | 'profile-edit' | 'public-profile', rideId?: string, userId?: string) => void;
}

export default function PostRide({ onNavigate }: PostRideProps) {
  const { user, loading: authLoading } = useAuth();
  const [formData, setFormData] = useState({
    from: '',
    to: '',
    date: '',
    time: '',
    availableSeats: '',
    pricePerSeat: '',
    pickupLocation: '',
    dropOffLocation: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      onNavigate('login');
    }
  }, [user, authLoading, onNavigate]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
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

    if (!formData.from.trim()) {
      newErrors.from = 'From location is required';
    }

    if (!formData.to.trim()) {
      newErrors.to = 'To location is required';
    }

    if (formData.from === formData.to) {
      newErrors.to = 'From and To locations must be different';
    }

    if (!formData.date) {
      newErrors.date = 'Date is required';
    } else {
      const selectedDate = new Date(formData.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selectedDate < today) {
        newErrors.date = 'Date cannot be in the past';
      }
    }

    if (!formData.time) {
      newErrors.time = 'Time is required';
    } else {
      // Check if date and time combination is in the past
      if (formData.date) {
        const dateTime = new Date(`${formData.date}T${formData.time}`);
        if (dateTime < new Date()) {
          newErrors.time = 'Date and time cannot be in the past';
        }
      }
    }

    if (!formData.availableSeats) {
      newErrors.availableSeats = 'Available seats is required';
    } else {
      const seats = parseInt(formData.availableSeats);
      if (isNaN(seats) || seats < 1 || seats > 8) {
        newErrors.availableSeats = 'Available seats must be between 1 and 8';
      }
    }

    if (!formData.pricePerSeat) {
      newErrors.pricePerSeat = 'Price per seat is required';
    } else {
      const price = parseFloat(formData.pricePerSeat);
      if (isNaN(price) || price <= 0) {
        newErrors.pricePerSeat = 'Price per seat must be greater than 0';
      }
    }

    if (!formData.pickupLocation.trim()) {
      newErrors.pickupLocation = 'Pickup location is required';
    }

    if (!formData.dropOffLocation.trim()) {
      newErrors.dropOffLocation = 'Drop-off location is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!user) {
      setError('You must be logged in to post a ride');
      return;
    }

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Combine date and time into ISO string
      const dateTime = new Date(`${formData.date}T${formData.time}`);
      const dateTimeISO = dateTime.toISOString();

      const seatsAvailable = parseInt(formData.availableSeats);
      const pricePerSeat = parseFloat(formData.pricePerSeat);

      const { error: insertError } = await supabase.from('rides').insert([
        {
          driver_id: user.id,
          departure_location: formData.from.trim(),
          arrival_location: formData.to.trim(),
          departure_spot: formData.pickupLocation.trim(),
          arrival_spot: formData.dropOffLocation.trim(),
          date_time: dateTimeISO,
          seats_available: seatsAvailable,
          seats_total: seatsAvailable,
          price_per_seat: pricePerSeat,
          status: 'upcoming',
        },
      ]);

      if (insertError) throw insertError;

      // Redirect to dashboard on success
      onNavigate('dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to post ride');
    } finally {
      setLoading(false);
    }
  };

  // Show loading or nothing if auth is loading or user is not logged in
  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="mb-6">
            <h2 className="text-3xl font-bold text-gray-900">Post a Ride</h2>
            <p className="mt-2 text-sm text-gray-600">
              Share your ride and help others travel
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Input
                  label="From"
                  name="from"
                  type="text"
                  value={formData.from}
                  onChange={handleChange}
                  required
                  error={errors.from}
                  placeholder="e.g., Gateshead"
                />
              </div>

              <div>
                <Input
                  label="To"
                  name="to"
                  type="text"
                  value={formData.to}
                  onChange={handleChange}
                  required
                  error={errors.to}
                  placeholder="e.g., London"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Input
                  label="Date"
                  name="date"
                  type="date"
                  value={formData.date}
                  onChange={handleChange}
                  required
                  error={errors.date}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div>
                <Input
                  label="Time"
                  name="time"
                  type="time"
                  value={formData.time}
                  onChange={handleChange}
                  required
                  error={errors.time}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Input
                  label="Available Seats"
                  name="availableSeats"
                  type="number"
                  min="1"
                  max="8"
                  value={formData.availableSeats}
                  onChange={handleChange}
                  required
                  error={errors.availableSeats}
                  placeholder="1-8"
                />
              </div>

              <div>
                <Input
                  label="Price per Seat"
                  name="pricePerSeat"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.pricePerSeat}
                  onChange={handleChange}
                  required
                  error={errors.pricePerSeat}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <Input
                label="Pickup Location"
                name="pickupLocation"
                type="text"
                value={formData.pickupLocation}
                onChange={handleChange}
                required
                error={errors.pickupLocation}
                placeholder="e.g., Gateshead Metro Station"
              />
            </div>

            <div>
              <Input
                label="Drop-off Location"
                name="dropOffLocation"
                type="text"
                value={formData.dropOffLocation}
                onChange={handleChange}
                required
                error={errors.dropOffLocation}
                placeholder="e.g., King's Cross Station"
              />
            </div>

            {error && (
              <ErrorAlert message={error} />
            )}

            <div className="flex flex-col space-y-3 pt-4">
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Posting Ride...' : 'Post Ride'}
              </Button>

              <div className="flex space-x-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => onNavigate('dashboard')}
                  className="flex-1"
                >
                  View Dashboard
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => onNavigate('home')}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
