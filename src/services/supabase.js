import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://waevdcqdkovqaxkonlvj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_BsNyiPJYPZDx8VdknHosFg_knBO1c2R';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
