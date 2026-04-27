import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("Missing Supabase environment variables (VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)");
}

const supabaseAdmin = createClient(supabaseUrl || "", supabaseServiceRoleKey || "", {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function ensureAdminUser() {
  const adminEmail = "pedro_santos@scouts.local";
  try {
    // Check if profiles table exists first
    const { error: tableCheckError } = await supabaseAdmin.from("profiles").select("id").limit(1);
    if (tableCheckError && tableCheckError.code === '42P01') {
      console.error("CRITICAL ERROR: The 'profiles' table does not exist in Supabase.");
      console.error("Please execute the SQL script provided to create the necessary tables.");
      return;
    }

    const { data, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;

    const adminUser = (data?.users as any[])?.find(u => u.email === adminEmail);
    
    if (!adminUser) {
      console.log("Creating default admin user...");
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: adminEmail,
        password: "Admin123",
        email_confirm: true,
        user_metadata: { display_name: "Pedro Santos" }
      });

      if (createError) throw createError;

      if (newUser.user) {
        const { error: profileError } = await supabaseAdmin
          .from("profiles")
          .upsert({
            id: newUser.user.id,
            email: adminEmail,
            display_name: "Pedro Santos",
            role: "admin_geral"
          });
        
        if (profileError) {
          console.error("Error creating admin profile:", profileError.message || profileError);
          if (profileError.details) console.error("Details:", profileError.details);
          if (profileError.hint) console.error("Hint:", profileError.hint);
        } else {
          console.log("Default admin user and profile created successfully.");
        }
      }
    } else {
      // User exists, ensure profile exists too
      const { data: profile, error: profileFetchError } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("id", adminUser.id)
        .single();
      
      if (profileFetchError || !profile) {
        console.log("Admin user exists but profile is missing. Creating profile...");
        const { error: profileError } = await supabaseAdmin
          .from("profiles")
          .upsert({
            id: adminUser.id,
            email: adminEmail,
            display_name: "Pedro Santos",
            role: "admin_geral"
          });
        if (profileError) {
          console.error("Error creating missing admin profile:", profileError.message || profileError);
          if (profileError.details) console.error("Details:", profileError.details);
          if (profileError.hint) console.error("Hint:", profileError.hint);
        } else {
          console.log("Admin profile created successfully.");
        }
      } else {
        console.log("Admin user and profile already exist.");
      }
    }
  } catch (error: any) {
    console.error("Error checking for admin user:", error);
  }
}

async function startServer() {
  await ensureAdminUser();
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API Route to create a user
  app.post("/api/users/create", async (req, res) => {
    const { email, password, displayName, role } = req.body;
    
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
  });

  // API Route to delete a user
  app.delete("/api/users/:uid", async (req, res) => {
    const { uid } = req.params;
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
  });

  // API Route to fetch a user profile
  app.get("/api/users/profile/:uid", async (req, res) => {
    const { uid } = req.params;
    
    if (!uid || uid === 'undefined' || uid === 'null') {
      return res.status(400).json({ error: "Invalid or missing UID" });
    }

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
  });

  // API Route to update a user's role
  app.post("/api/users/update-role", async (req, res) => {
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
  });

  // API Route to update requires_password_change
  app.post("/api/users/password-changed", async (req, res) => {
    const { uid } = req.body;
    try {
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ requires_password_change: false })
        .eq("id", uid);
      
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error updating password change status:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
