import { createClient } from "@supabase/supabase-js";

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });
  
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) return res.status(500).json({ error: "Missing Server Config" });
  
  const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { email, password, displayName, role } = req.body;
  if (!email || !password || !displayName || !role) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName }
    });

    if (createError) throw createError;

    if (newUser.user) {
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .insert({
          id: newUser.user.id,
          email,
          display_name: displayName,
          role
        });
      
      if (profileError) throw profileError;
    }

    res.json({ success: true, uid: newUser.user?.id });
  } catch (error: any) {
    console.error("Error creating user:", error);
    res.status(500).json({ error: error.message });
  }
}
