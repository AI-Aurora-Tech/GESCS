import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL || "", process.env.SUPABASE_SERVICE_ROLE_KEY || "");

async function test() {
  const { data, error } = await supabaseAdmin.from("profiles").select("*").limit(1);
  console.log("Data:", data);
  console.log("Error:", error);
}
test();
