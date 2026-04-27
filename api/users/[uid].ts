import { createClient } from "@supabase/supabase-js";

export default async function handler(req: any, res: any) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: "Method not allowed" });
  
  const uid = req.query.uid;
  if (!uid) return res.status(400).json({ error: "Missing UID" });
  
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) return res.status(500).json({ error: "Missing Server Config" });
  
  const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  try {
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(uid);
    if (deleteAuthError) throw deleteAuthError;

    const { error: deleteProfileError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", uid);
    
    if (deleteProfileError) throw deleteProfileError;

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: error.message });
  }
}
