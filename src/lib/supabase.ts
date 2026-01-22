import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Profile {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  gender: 'Male' | 'Female' | 'Prefer not to say' | null;
  travel_status: 'solo' | 'couple';
  partner_name: string | null;
  profile_photo_url: string | null;
  is_verified: boolean;
  is_admin: boolean;
  stripe_connect_account_id: string | null;
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
  additional_notes: string | null;
  status: 'upcoming' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
  driver?: Profile;
}

export interface Booking {
  id: string;
  ride_id: string;
  passenger_id: string;
  seats_booked: number;
  total_paid: number;
  commission_amount: number;
  driver_payout_amount: number;
  stripe_payment_intent_id: string | null;
  stripe_payout_id: string | null;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'refunded';
  cancellation_refund_amount: number | null;
  cancelled_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  ride?: Ride;
  passenger?: Profile;
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

    // Different genders or "Prefer not to say" - not compatible for safety
    return false;
  }

  return false;
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
