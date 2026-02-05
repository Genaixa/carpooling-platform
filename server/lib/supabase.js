// ~/carpooling-platform/server/lib/supabase.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fiylgivjirvmgkytejep.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpeWxnaXZqaXJ2bWdreXRlamVwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTA4OTI1NSwiZXhwIjoyMDg0NjY1MjU1fQ.ifLBGtb2O-Hhhmaq0OysOJdyg6rFvwcM4ao3JoWJXx0';

export const supabase = createClient(supabaseUrl, supabaseKey);
