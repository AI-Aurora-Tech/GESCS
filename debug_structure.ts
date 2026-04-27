import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL || "", process.env.SUPABASE_SERVICE_ROLE_KEY || "");

async function getStructure() {
  const { data, error } = await supabaseAdmin.rpc('get_table_columns', { table_name: 'products' });
  if (error) {
    // If RPC doesn't exist, try direct query to information_schema (might fail due to RLS/Permissions)
    console.log("RPC get_table_columns not found, trying direct query...");
    const { data: data2, error: error2 } = await supabaseAdmin
      .from('products')
      .select('*')
      .limit(0);
    
    if (error2) {
      console.log("Error selecting:", error2);
    } else {
      console.log("Successfully selected 0 rows. Headers should contain column info if I could see them.");
      // In JS we can't see the headers from 'from().select()' easily as it's parsed.
    }
  } else {
    console.log("Columns:", data);
  }
}

getStructure();
