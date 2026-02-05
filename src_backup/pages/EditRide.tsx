import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Ride } from '../lib/supabase';
import { Input } from '../components/Input';
import Button from '../components/Button';
import Loading from '../components/Loading';


interface EditRideProps {
  onNavigate: (page: 'home' | 'login' | 'register' | 'profile' | 'post-ride' | 'dashboard' | 'edit-ride' | 'ride-details' | 'my-bookings' | 'profile-edit' | 'public-profile', rideId?: string, userId?: string) => void;
  rideId: string;
}


export default function EditRide({ onNavigate, rideId }: EditRideProps) {
  const { user, loading: authLoading } = useAuth();
  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [hasBookings, setHasBookings] = useState(false);
  const [bookingCount, setBookingCount] = useState(0);

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


  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      onNavigate('login');
    }
  }, [user, authLoading, onNavigate]);


  // Load ride data
  useEffect(() => {
    if (user && rideId) {
      loadRide();
    }
  }, [user, rideId]);


  const loadRide = async () => {
    if (!user || !rideId) return;

    try {
      setLoading(true);
      
      // Load ride data
      const { data, error } = await supabase
        .from('rides')
        .select('*')
        .eq('id', rideId)
        .eq('driver_id', user.id)
        .single();

      if (error) throw error;

      if (!data) {
        setError('Ride not found');
        return;
      }

      setRide(data);

      // Check for existing bookings
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('id, seats_booked')
        .eq('ride_id', rideId)
        .in('status', ['pending', 'confirmed']);

      if (bookingsError) throw bookingsError;

      const existingBookings = bookingsData || [];
      setHasBookings(existingBookings.length > 0);
      setBookingCount(existingBookings.length);

      // Parse date_time to separate date and time
      const dateTime = new Date(data.date_time);
      const date = dateTime.toISOString().split('T')[0];
      const time = dateTime.toTimeString().slice(0, 5); // HH:MM format

      // Pre-fill form with existing ride data
      setFormData({
        from: data.departure_location,
        to: data.arrival_location,
        date: date,
        time: time,
        availableSeats: data.seats_available.toString(),
        pricePerSeat: data.price_per_seat.toString(),
        pickupLocation: data.departure_spot || '',
        dropOffLocation: data.arrival_spot || '',
      });
    } catch (error: any) {
      console.error('Error loading ride:', error);
      setError(error.message || 'Failed to load ride');
    } finally {
      setLoading(false);
    }
  };


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
      
      // If bookings exist, ensure available seats isn't less than booked seats
      if (hasBookings && ride) {
        const bookedSeats = ride.seats_total - ride.seats_available;
        if (seats < bookedSeats) {
          newErrors.availableSeats = `Cannot reduce seats below ${bookedSeats} (already booked)`;
        }
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
    setSuccess('');

    if (!user || !rideId) {
      setError('You must be logged in to edit a ride');
      return;
    }

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);

    try {
      // Combine date and time into ISO string
      const dateTime = new Date(`${formData.date}T${formData.time}`);
      const dateTimeISO = dateTime.toISOString();

      const seatsAvailable = parseInt(formData.availableSeats);
      const pricePerSeat = parseFloat(formData.pricePerSeat);

      // Calculate booked seats
      const bookedSeats = ride ? ride.seats_total - ride.seats_available : 0;
      const newSeatsTotal = seatsAvailable + bookedSeats;

      const { error: updateError } = await supabase
        .from('rides')
        .update({
          departure_location: formData.from.trim(),
          arrival_location: formData.to.trim(),
          departure_spot: formData.pickupLocation.trim(),
          arrival_spot: formData.dropOffLocation.trim(),
          date_time: dateTimeISO,
          seats_available: seatsAvailable,
          seats_total: newSeatsTotal,
          price_per_seat: pricePerSeat,
        })
        .eq('id', rideId)
        .eq('driver_id', user.id);

      if (updateError) throw updateError;

      setSuccess('Ride updated successfully!');
      
      // Redirect to dashboard after a short delay to show success message
      setTimeout(() => {
        onNavigate('dashboard');
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to update ride');
    } finally {
      setSubmitting(false);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loading message="Loading ride details..." />
      </div>
    );
  }

  if (error && !ride) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow-md p-8">
            <div className="text-center">
              <p className="text-red-600 mb-4">{error}</p>
              <Button onClick={() => onNavigate('dashboard')}>
                Back to Dashboard
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="mb-6">
            <h2 className="text-3xl font-bold text-gray-900">Edit Ride</h2>
            <p className="mt-2 text-sm text-gray-600">
              Update your ride details
            </p>
          </div>

          {hasBookings && (
            <div className="mb-6 rounded-md bg-yellow-50 p-4 border border-yellow-200">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">
                    This ride has {bookingCount} active booking{bookingCount > 1 ? 's' : ''}
                  </h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <p>
                      Please note: Major changes (date, time, locations) may impact passengers. 
                      Consider contacting them before making significant updates.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

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
                {hasBookings && ride && (
                  <p className="mt-1 text-xs text-gray-500">
                    {ride.seats_total - ride.seats_available} seat(s) already booked
                  </p>
                )}
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
              <div className="rounded-md bg-red-50 p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {success && (
              <div className="rounded-md bg-green-50 p-4">
                <p className="text-sm text-green-800">{success}</p>
              </div>
            )}

            <div className="flex flex-col space-y-3 pt-4">
              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? 'Updating...' : 'Update Ride'}
              </Button>

              <Button
                type="button"
                variant="secondary"
                onClick={() => onNavigate('dashboard')}
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
