import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL || "", process.env.SUPABASE_SERVICE_ROLE_KEY || "");

async function check() {
  const { data, error } = await supabaseAdmin.rpc('get_policies');
  console.log("Policies:", data);
  
  // Let's just query pg_policies
  const { data: policies, error: polError } = await supabaseAdmin.from('pg_policies').select('*').eq('tablename', 'profiles');
  console.log("pg_policies:", policies, polError);
}
check();
