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
    // 1) Remove o PERFIL primeiro. A FK profiles.id -> auth.users.id normalmente
    //    é RESTRICT, então excluir o usuário do Auth com o perfil ainda existente
    //    causa "Database error deleting user". Removendo o perfil antes, resolve.
    const { error: deleteProfileError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", uid);
    if (deleteProfileError) throw deleteProfileError;

    // 2) Remove o usuário do Auth.
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(uid);
    if (deleteAuthError) throw deleteAuthError;

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: error.message || "Erro ao excluir usuário" });
  }
}
