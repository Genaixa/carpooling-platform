import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Profile {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  gender: 'Male' | 'Female' | null;
  travel_status: 'solo' | 'couple';
  partner_name: string | null;
  profile_photo_url: string | null;
  is_verified: boolean;
  is_admin: boolean;
  is_approved_driver: boolean;
  average_rating: number | null;
  total_reviews: number;
  created_at: string;
  updated_at: string;
}

export interface Ride {
  id: string;
  driver_id: string;
  departure_location: string;
  arrival_location: string;
  departure_spot: string | null;
  arrival_spot: string | null;
  meeting_point_details: string | null;
  date_time: string;
  seats_available: number;
  seats_total: number;
  price_per_seat: number;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_color: string | null;
  vehicle_registration: string | null;
  luggage_size: 'none' | 'small' | 'medium' | 'large' | null;
  luggage_count: number | null;
  additional_notes: string | null;
  status: 'upcoming' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
  driver?: Profile;
  bookings?: Array<{ seats_booked: number }>;
}

export interface Booking {
  id: string;
  ride_id: string;
  passenger_id: string;
  seats_booked: number;
  total_paid: number;
  commission_amount: number;
  driver_payout_amount: number;
  square_payment_id: string | null;
  square_payout_id: string | null;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'refunded' | 'pending_driver';
  driver_action: 'accepted' | 'rejected' | null;
  driver_action_at: string | null;
  cancellation_refund_amount: number | null;
  cancelled_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  ride?: Ride;
  passenger?: Profile;
}

export interface DriverApplication {
  id: string;
  user_id: string;
  first_name: string;
  surname: string;
  age_group: '18-25' | '26-35' | '36-45' | '46-55' | '56+';
  gender: 'Male' | 'Female';
  has_drivers_license: boolean;
  car_insured: boolean;
  has_mot: boolean;
  car_make: string;
  car_model: string;
  years_driving_experience: number;
  dbs_check_acknowledged: boolean;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  user?: Profile;
}

export interface Review {
  id: string;
  reviewer_id: string;
  reviewee_id: string;
  ride_id: string;
  booking_id: string;
  rating: number;
  comment: string | null;
  type: 'driver-to-passenger' | 'passenger-to-driver';
  created_at: string;
  reviewer?: Profile;
  reviewee?: Profile;
}

/**
 * CRITICAL: Checks if a passenger can see/book a ride based on travel status + gender compatibility
 * Database uses separate travel_status ('solo'/'couple') and gender ('Male'/'Female') fields
 *
 * Rules:
 * - Couples can see ALL rides
 * - Solo Male passengers can see: Solo Male drivers + Couple drivers
 * - Solo Female passengers can see: Solo Female drivers + Couple drivers
 * - Solo males and solo females CANNOT see each other's rides
 */
export function checkRideCompatibility(
  passengerTravelStatus: 'solo' | 'couple',
  passengerGender: string | null,
  driverTravelStatus: 'solo' | 'couple',
  driverGender: string | null
): boolean {
  // Couples can see all rides
  if (passengerTravelStatus === 'couple') {
    return true;
  }

  // Driver is a couple - everyone can see
  if (driverTravelStatus === 'couple') {
    return true;
  }

  // Both are solo - must match gender
  if (passengerTravelStatus === 'solo' && driverTravelStatus === 'solo') {
    if (passengerGender === 'Male' && driverGender === 'Male') {
      return true;
    }

    if (passengerGender === 'Female' && driverGender === 'Female') {
      return true;
    }

    // Different genders - not compatible for safety
    return false;
  }

  return false;
}

/**
 * Returns a human-readable reason why a ride is incompatible, or null if compatible.
 */
export function getIncompatibilityReason(
  passengerTravelStatus: 'solo' | 'couple',
  passengerGender: string | null,
  driverTravelStatus: 'solo' | 'couple',
  driverGender: string | null
): string | null {
  if (checkRideCompatibility(passengerTravelStatus, passengerGender, driverTravelStatus, driverGender)) {
    return null;
  }

  if (passengerTravelStatus === 'solo' && driverTravelStatus === 'solo') {
    if (passengerGender === 'Male' && driverGender === 'Female') {
      return 'This ride is not available for solo male passengers';
    }
    if (passengerGender === 'Female' && driverGender === 'Male') {
      return 'This ride is not available for solo female passengers';
    }
    return 'This ride is not compatible with your travel status';
  }

  return 'This ride is not compatible with your travel status';
}

export function getTravelStatusLabel(travelStatus: 'solo' | 'couple', gender: string | null, partnerName: string | null): string {
  if (travelStatus === 'couple' && partnerName) {
    return `Couple: ${partnerName}`;
  }

  if (travelStatus === 'solo' && gender) {
    return `Solo ${gender}`;
  }

  return 'Status Unknown';
}

/**
 * Returns true if contact details should be visible (within 12 hours of ride departure).
 */
export function isContactVisible(rideDateTime: string): boolean {
  const rideTime = new Date(rideDateTime).getTime();
  const now = Date.now();
  const twelveHoursMs = 12 * 60 * 60 * 1000;
  return (rideTime - now) <= twelveHoursMs;
}
