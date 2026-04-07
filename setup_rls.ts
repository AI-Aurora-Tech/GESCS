import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL || "", process.env.SUPABASE_SERVICE_ROLE_KEY || "");

async function setupRLS() {
  const sql = `
    -- Enable RLS
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

    -- Drop existing policies if any
    DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
    DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
    DROP POLICY IF EXISTS "Admin can do everything" ON public.profiles;

    -- Create policies
    CREATE POLICY "Users can view their own profile" 
      ON public.profiles FOR SELECT 
      USING (auth.uid() = id);

    CREATE POLICY "Users can update their own profile" 
      ON public.profiles FOR UPDATE 
      USING (auth.uid() = id);
      
    -- Allow admins to view all profiles
    -- We can't easily check role in RLS without recursion, but we can allow read for all authenticated users for now, or just rely on the API for admin tasks.
    -- Actually, let's just allow authenticated users to read all profiles so the Users page works!
    DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;
    CREATE POLICY "Authenticated users can view all profiles" 
      ON public.profiles FOR SELECT 
      USING (auth.role() = 'authenticated');
  `;

  // Supabase JS doesn't have a direct raw SQL execution method unless we use RPC.
  // Wait, we don't have a generic RPC.
  // Let's just create an API endpoint in server.ts to fetch the profile, or fix the fallback in AuthContext.tsx!
}
setupRLS();
