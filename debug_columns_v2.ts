import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL || "", process.env.SUPABASE_SERVICE_ROLE_KEY || "");

async function checkColumns(table: string) {
  const { data, error } = await supabaseAdmin.from(table).select("*").limit(1);
  if (error) {
    console.log(`Table ${table} error:`, error.message);
    return;
  }
  if (data && data.length > 0) {
    console.log(`Columns for ${table}:`, Object.keys(data[0]));
  } else {
    // If no data, try to insert a mostly empty row to trigger error or find columns
    console.log(`No data in ${table}, trying to find columns...`);
    // PostgREST doesn't easily expose empty table columns without data or specific queries.
  }
}

async function run() {
  await checkColumns('products');
  await checkColumns('profiles');
  await checkColumns('assets');
  await checkColumns('scout_members');
}

run();
