import { createClient } from "@supabase/supabase-js";

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });
  
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) return res.status(500).json({ error: "Missing Server Config" });
  
  const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { uid, role } = req.body;
  
  try {
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ role })
      .eq("id", uid);
    
    if (error) throw error;
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error updating role:", error);
    res.status(500).json({ error: error.message });
  }
}
