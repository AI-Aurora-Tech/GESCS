import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabaseAnon = createClient(supabaseUrl || '', supabaseAnonKey || '');

async function check() {
  const newProfile = {
    id: '00000000-0000-0000-0000-000000000000',
    email: 'test@test.com',
    display_name: 'Test',
    role: 'user_lojinha',
    requires_password_change: false
  };
  const { data, error } = await supabaseAnon.from('profiles').upsert([newProfile]).select().single();
  console.log('Anon upsert:', data ? 'Success' : 'Failed', error);
}
check();
