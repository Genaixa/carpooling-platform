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
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postcode: string | null;
  country: string | null;
  age_group: '18-25' | '26-35' | '36-45' | '46-55' | '56+' | null;
  marital_status: 'Single' | 'Married' | null;
  driver_tier: 'regular' | 'gold';
  licence_photo_url: string | null;
  licence_status: 'pending' | 'approved' | 'rejected' | null;
  average_rating: number | null;
  total_reviews: number;
  notify_driver_alerts: boolean;
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
  existing_occupants: { males: number; females: number; couples: number } | null;
  additional_notes: string | null;
  status: 'upcoming' | 'completed' | 'cancelled';
  reminder_sent: boolean;
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
  contact_email_sent?: boolean;
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
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_sort_code: string | null;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  user?: Profile;
}

export interface DriverPayout {
  id: string;
  driver_id: string;
  amount: number;
  admin_id: string;
  notes: string | null;
  created_at: string;
  driver?: Profile;
  admin?: Profile;
}

export interface RideWish {
  id: string;
  user_id: string;
  departure_location: string;
  arrival_location: string;
  desired_date: string;
  desired_time: string | null;
  passengers_count: number;
  booking_for: 'myself' | 'someone-else';
  third_party_gender: string | null;
  third_party_age_group: string | null;
  status: 'active' | 'fulfilled' | 'expired';
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
 * Computes the total car composition: driver (by gender) + existing occupants.
 */
export function getCarComposition(
  driverGender: string | null,
  existingOccupants: { males: number; females: number; couples: number } | null
): { males: number; females: number; couples: number } {
  let males = existingOccupants?.males || 0;
  let females = existingOccupants?.females || 0;
  const couples = existingOccupants?.couples || 0;

  // Each couple is 1 man + 1 woman
  males += couples;
  females += couples;

  if (driverGender === 'Male') {
    males += 1;
  } else if (driverGender === 'Female') {
    females += 1;
  }

  return { males, females, couples };
}

/**
 * Returns a human-readable summary of who's in the car, e.g. "2 men, 1 woman"
 */
export function getCarCompositionLabel(composition: { males: number; females: number; couples: number }): string {
  const parts: string[] = [];
  if (composition.males > 0) parts.push(`${composition.males} ${composition.males === 1 ? 'man' : 'men'}`);
  if (composition.females > 0) parts.push(`${composition.females} ${composition.females === 1 ? 'woman' : 'women'}`);
  if (composition.couples > 0) parts.push(`${composition.couples} ${composition.couples === 1 ? 'couple' : 'couples'}`);
  return parts.length > 0 ? parts.join(', ') : 'No occupants listed';
}

/**
 * Returns a plain-English car occupants label, e.g. "Driver (Male), 1 man, 1 woman".
 * Couples are expanded into individual men/women.
 */
export function getCarLabel(
  driverGender: string | null,
  existingOccupants: { males: number; females: number; couples: number } | null
): string {
  const parts: string[] = [];
  if (driverGender) parts.push(`Driver (${driverGender})`);
  const males = (existingOccupants?.males || 0) + (existingOccupants?.couples || 0);
  const females = (existingOccupants?.females || 0) + (existingOccupants?.couples || 0);
  if (males > 0) parts.push(`${males} ${males === 1 ? 'man' : 'men'}`);
  if (females > 0) parts.push(`${females} ${females === 1 ? 'woman' : 'women'}`);
  return parts.length > 0 ? parts.join(', ') : 'No occupants listed';
}

/**
 * CRITICAL: Checks if a passenger can book a ride based on total car composition.
 * Each couple counts as 1 man + 1 woman (already expanded in getCarComposition).
 *
 * Rules:
 * - Female passenger → compatible if at least 1 female in the car
 * - Male passenger → compatible if at least 1 male in the car
 */
export function checkRideCompatibility(
  passengerGender: string | null,
  driverGender: string | null,
  existingOccupants?: { males: number; females: number; couples: number } | null
): boolean {
  const composition = getCarComposition(driverGender, existingOccupants || null);

  if (passengerGender === 'Female') {
    return composition.females >= 1;
  }

  if (passengerGender === 'Male') {
    return composition.males >= 1;
  }

  // Unknown gender - allow access
  return true;
}

/**
 * Returns a human-readable reason why a ride is incompatible, or null if compatible.
 */
export function getIncompatibilityReason(
  passengerGender: string | null,
  driverGender: string | null,
  existingOccupants?: { males: number; females: number; couples: number } | null
): string | null {
  if (checkRideCompatibility(passengerGender, driverGender, existingOccupants)) {
    return null;
  }

  if (passengerGender === 'Female') {
    return 'No women or couples currently in this car';
  }

  if (passengerGender === 'Male') {
    return 'No men or couples currently in this car';
  }

  return 'This ride is not compatible with your gender';
}

/**
 * Returns true if a given date falls on Shabbat (Saturday) or a Yom Tov (major Jewish festival).
 * Uses @hebcal/core for accurate diaspora (UK) holiday calculation.
 */
function isShabbatOrYomTov(date: Date): boolean {
  if (date.getDay() === 6) return true; // Saturday = Shabbat
  try {
    const { HDate, HebrewCalendar, flags } = require('@hebcal/core');
    const hdate = new HDate(date);
    const events = HebrewCalendar.getHolidaysOnDate(hdate, false); // false = diaspora
    if (events && events.length > 0) {
      return events.some((ev: any) => (ev.getFlags() & flags.CHAG) !== 0);
    }
  } catch {}
  return false;
}

/**
 * Walks back from a restricted day to find 8am on the day the Shabbat/YomTov block started.
 * Handles multi-day restrictions (e.g. 2-day Yom Tov, or Yom Tov running into Shabbat).
 */
function getEarlyRevealTime(restrictedDay: Date): Date {
  const day = new Date(restrictedDay);
  day.setHours(12, 0, 0, 0); // use noon to avoid DST edge cases
  while (isShabbatOrYomTov(day)) {
    day.setDate(day.getDate() - 1);
  }
  // day is now the last non-restricted day — move forward one to get the start of restriction
  day.setDate(day.getDate() + 1);
  day.setHours(8, 0, 0, 0);
  return day;
}

/**
 * Returns true if contact details should be visible.
 *
 * Normal rule: within 24 hours of departure.
 *
 * Shabbat/Yom Tov override: if the ride is before noon on the day after a Shabbat or
 * Yom Tov block, reveal from 8am on the day the restricted period started — so that
 * passengers and drivers can make arrangements before Shabbat/Yom Tov begins.
 */
export function isContactVisible(rideDateTime: string): boolean {
  const rideTime = new Date(rideDateTime);
  const now = Date.now();
  const twentyFourHoursMs = 24 * 60 * 60 * 1000;

  // Standard 24h rule
  if ((rideTime.getTime() - now) <= twentyFourHoursMs) return true;

  // Shabbat/Yom Tov early reveal: ride is before noon on the day after a restricted period
  if (rideTime.getHours() < 12) {
    const dayBefore = new Date(rideTime);
    dayBefore.setDate(dayBefore.getDate() - 1);
    dayBefore.setHours(12, 0, 0, 0);
    if (isShabbatOrYomTov(dayBefore)) {
      const earlyReveal = getEarlyRevealTime(dayBefore);
      if (now >= earlyReveal.getTime()) return true;
    }
  }

  return false;
}

// Short 8-char human-readable reference codes from UUID prefix
export function getRideRef(rideId: string): string {
  return rideId.substring(0, 8).toUpperCase();
}
export function getUserRef(userId: string): string {
  return userId.substring(0, 8).toUpperCase();
}

// Generate a consistent anonymous driver number from a UUID
export function getDriverAlias(driverId: string): string {
  let hash = 0;
  for (let i = 0; i < driverId.length; i++) {
    hash = ((hash << 5) - hash + driverId.charCodeAt(i)) | 0;
  }
  const num = Math.abs(hash) % 10000;
  return `Driver #${num.toString().padStart(4, '0')}`;
}

// Generate a consistent anonymous passenger number from a UUID
export function getPassengerAlias(passengerId: string): string {
  let hash = 0;
  for (let i = 0; i < passengerId.length; i++) {
    hash = ((hash << 5) - hash + passengerId.charCodeAt(i)) | 0;
  }
  const num = Math.abs(hash) % 10000;
  return `Passenger #${num.toString().padStart(4, '0')}`;
}
