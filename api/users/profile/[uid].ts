import { createClient } from "@supabase/supabase-js";

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: "Method not allowed" });
  
  const uid = req.query.uid;
  if (!uid || uid === 'undefined' || uid === 'null') {
    return res.status(400).json({ error: "Invalid or missing UID" });
  }
  
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ 
      error: "Missing Server Config", 
      details: "Você precisa configurar as variáveis de ambiente VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no Vercel."
    });
  }
  
  const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  try {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", uid)
      .single();
    
    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ error: error.message });
  }
}
