import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://waevdcqdkovqaxkonlvj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhZXZkY3Fka292cWF4a29ubHZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2MTU4MTAsImV4cCI6MjA5MzE5MTgxMH0.Oq_vfSa5diP9jNRfjbF-OfbMMg7HEaHixm-4hGEqGOE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
