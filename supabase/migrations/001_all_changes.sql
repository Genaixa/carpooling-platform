-- =============================================================================
-- ChapaRide Platform - Complete Database Migration
-- All 11 changes + Stripe-to-Square migration
--
-- INSTRUCTIONS: Copy and paste this entire file into the Supabase SQL Editor
-- Dashboard: https://supabase.com/dashboard/project/fiylgivjirvmgkytejep/sql/new
-- Then click "Run" to execute all statements.
-- =============================================================================

BEGIN;

-- ============================================================
-- 1. PROFILES TABLE: Rename columns & add new fields
-- ============================================================
-- Current columns: id, user_id, full_name, avatar_url, phone, gender,
--                  travel_status, partner_name, created_at, updated_at
-- Code expects:    id (=auth uid), email, name, profile_photo_url, phone, gender,
--                  travel_status, partner_name, is_verified, is_admin,
--                  is_approved_driver, average_rating, total_reviews

-- Rename full_name -> name (code uses profile.name everywhere)
ALTER TABLE profiles RENAME COLUMN full_name TO name;

-- Rename avatar_url -> profile_photo_url (code uses profile.profile_photo_url)
ALTER TABLE profiles RENAME COLUMN avatar_url TO profile_photo_url;

-- Add email column (code stores email in profiles for easy access)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email text;

-- Add driver approval flag (Change 1: Driver Application System)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_approved_driver boolean NOT NULL DEFAULT false;

-- Add admin flag (for AdminDashboard access)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- Add verified flag
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false;

-- Add review/rating fields (Change 11: Reviews & Ratings)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS average_rating numeric;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_reviews integer NOT NULL DEFAULT 0;

-- Backfill email from auth.users for any existing profiles
UPDATE profiles p
SET email = au.email
FROM auth.users au
WHERE p.user_id = au.id
  AND p.email IS NULL;

-- ============================================================
-- 2. RIDES TABLE: Add luggage fields (Change 3)
-- ============================================================

ALTER TABLE rides ADD COLUMN IF NOT EXISTS luggage_size text DEFAULT 'none';
ALTER TABLE rides ADD COLUMN IF NOT EXISTS luggage_count integer DEFAULT 0;

-- ============================================================
-- 3. BOOKINGS TABLE: Square migration + booking flow fields
-- ============================================================

-- Add Square payment columns (Change 4: replacing Stripe)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS square_payment_id text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS square_payout_id text;

-- Add driver accept/reject flow columns (Change 4: Hold/Confirm)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS driver_action text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS driver_action_at timestamptz;

-- Add completed_at for ride completion tracking
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Copy any existing Stripe payment IDs to Square columns (preserves history)
UPDATE bookings
SET square_payment_id = stripe_payment_intent_id
WHERE stripe_payment_intent_id IS NOT NULL
  AND square_payment_id IS NULL;

UPDATE bookings
SET square_payout_id = stripe_payout_id
WHERE stripe_payout_id IS NOT NULL
  AND square_payout_id IS NULL;

-- ============================================================
-- 4. NEW TABLE: driver_applications (Change 1)
-- ============================================================

CREATE TABLE IF NOT EXISTS driver_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  surname text NOT NULL,
  age_group text NOT NULL CHECK (age_group IN ('18-25', '26-35', '36-45', '46-55', '56+')),
  gender text NOT NULL CHECK (gender IN ('Male', 'Female', 'Prefer not to say')),
  has_drivers_license boolean NOT NULL DEFAULT false,
  car_insured boolean NOT NULL DEFAULT false,
  has_mot boolean NOT NULL DEFAULT false,
  car_make text NOT NULL,
  car_model text NOT NULL,
  years_driving_experience integer NOT NULL DEFAULT 0,
  dbs_check_acknowledged boolean NOT NULL DEFAULT false,
  emergency_contact_name text NOT NULL,
  emergency_contact_phone text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes text,
  reviewed_by uuid REFERENCES profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_applications_user_id ON driver_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_driver_applications_status ON driver_applications(status);

-- ============================================================
-- 5. NEW TABLE: reviews (Change 11)
-- ============================================================

CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reviewee_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ride_id uuid NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  type text NOT NULL CHECK (type IN ('driver-to-passenger', 'passenger-to-driver')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reviewer_id, booking_id, type)
);

CREATE INDEX IF NOT EXISTS idx_reviews_reviewee_id ON reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_reviews_ride_id ON reviews(ride_id);
CREATE INDEX IF NOT EXISTS idx_reviews_booking_id ON reviews(booking_id);

-- ============================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- Enable RLS on new tables
ALTER TABLE driver_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Driver Applications policies
CREATE POLICY "Users can view own applications"
  ON driver_applications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own applications"
  ON driver_applications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all applications"
  ON driver_applications FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can update applications"
  ON driver_applications FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Reviews policies
CREATE POLICY "Anyone can view reviews"
  ON reviews FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert own reviews"
  ON reviews FOR INSERT
  WITH CHECK (auth.uid() = reviewer_id);

-- ============================================================
-- 7. UPDATE EXISTING RLS POLICIES FOR PROFILES
-- ============================================================
-- Ensure profiles table allows reading new columns
-- (Existing SELECT policies should already cover this since they use *)

-- Add policy for updating own profile's is_approved_driver (admin only via server)
-- The server uses the service_role key which bypasses RLS, so no policy needed

-- ============================================================
-- 8. GRANT ACCESS TO NEW TABLES
-- ============================================================

GRANT ALL ON driver_applications TO service_role;
GRANT ALL ON reviews TO service_role;

GRANT SELECT, INSERT ON driver_applications TO authenticated;
GRANT SELECT, INSERT ON reviews TO authenticated;
GRANT SELECT ON driver_applications TO anon;
GRANT SELECT ON reviews TO anon;

-- ============================================================
-- 9. REFRESH POSTGREST SCHEMA CACHE
-- ============================================================

NOTIFY pgrst, 'reload schema';

COMMIT;
