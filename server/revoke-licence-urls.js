import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!VITE_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('FATAL: Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function revoke() {
  console.log('Fetching all profiles with a licence photo...');

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, licence_photo_url, licence_status')
    .not('licence_photo_url', 'is', null);

  if (error) {
    console.error('Failed to fetch profiles:', error.message);
    process.exit(1);
  }

  if (!profiles.length) {
    console.log('No licence photos found.');
    return;
  }

  console.log(`Found ${profiles.length} profile(s) with a licence photo.\n`);
  let deleted = 0;
  let failed = 0;

  for (const profile of profiles) {
    let fileName = profile.licence_photo_url;
    // Handle any remaining legacy full URLs just in case
    if (fileName.startsWith('http')) {
      const match = fileName.match(/\/licence-photos\/([^?]+)/);
      if (!match) {
        console.warn(`  SKIP ${profile.id} — could not extract filename`);
        failed++;
        continue;
      }
      fileName = match[1];
    }

    const { error: deleteError } = await supabase.storage
      .from('licence-photos')
      .remove([fileName]);

    if (deleteError) {
      console.error(`  FAIL ${profile.id} (${fileName}): ${deleteError.message}`);
      failed++;
    } else {
      console.log(`  DELETED ${profile.id} (${fileName}) [status: ${profile.licence_status}]`);
      deleted++;
    }
  }

  // Clear licence_photo_url for all affected profiles so the "View" button disappears
  if (deleted > 0) {
    const ids = profiles.map(p => p.id);
    await supabase.from('profiles').update({ licence_photo_url: null }).in('id', ids);
    console.log(`\nCleared licence_photo_url for ${deleted} profile(s).`);
  }

  console.log(`\nDone. ${deleted} file(s) deleted from storage, ${failed} failed.`);
  console.log('Affected users will need to re-upload their licence photo.');
}

revoke();
