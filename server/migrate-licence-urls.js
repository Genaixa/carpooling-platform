import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!VITE_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('FATAL: Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function migrate() {
  console.log('Fetching profiles with stored signed URLs...');

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, licence_photo_url')
    .not('licence_photo_url', 'is', null)
    .like('licence_photo_url', 'http%');

  if (error) {
    console.error('Failed to fetch profiles:', error.message);
    process.exit(1);
  }

  if (!profiles.length) {
    console.log('No records to migrate — all licence_photo_url values are already filenames.');
    return;
  }

  console.log(`Found ${profiles.length} record(s) to migrate.`);
  let updated = 0;
  let failed = 0;

  for (const profile of profiles) {
    const match = profile.licence_photo_url.match(/\/licence-photos\/([^?]+)/);
    if (!match) {
      console.warn(`  SKIP ${profile.id} — could not extract filename from: ${profile.licence_photo_url}`);
      failed++;
      continue;
    }

    const fileName = match[1];
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ licence_photo_url: fileName })
      .eq('id', profile.id);

    if (updateError) {
      console.error(`  FAIL ${profile.id}: ${updateError.message}`);
      failed++;
    } else {
      console.log(`  OK   ${profile.id} -> ${fileName}`);
      updated++;
    }
  }

  console.log(`\nDone. ${updated} updated, ${failed} failed.`);
}

migrate();
