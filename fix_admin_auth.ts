import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

async function fixAdminAuth() {
  const email = "ai.auroratech@gmail.com";
  const password = "Admin@123";
  const profileId = "798ad93e-eb50-4f7a-85c4-5b598f37a01a";

  console.log(`Checking user: ${email}`);

  // 1. Check if user exists in Auth
  const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
  if (listError) {
    console.error("Error listing users:", listError);
    return;
  }

  const authUser = (users.users as any[]).find(u => u.email === email);

  if (authUser) {
    console.log(`User found in Auth with ID: ${authUser.id}`);
    
    // Update password to be sure
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      authUser.id,
      { password: password, email_confirm: true }
    );
    
    if (updateError) {
      console.error("Error updating user password:", updateError);
    } else {
      console.log("Password updated successfully to Admin@123");
    }

    // Check if ID matches profile
    if (authUser.id !== profileId) {
      console.log(`ID mismatch! Auth ID: ${authUser.id}, Profile ID: ${profileId}`);
      console.log("Updating profile ID to match Auth ID...");
      
      // We can't easily update the primary key 'id' in Supabase via the client if it's a PK.
      // Better to delete the old profile and create a new one with the correct ID,
      // or update the Auth user ID (but we can't update Auth ID).
      
      // Let's try to update the profile ID first
      const { error: profileUpdateError } = await supabaseAdmin
        .from("profiles")
        .update({ id: authUser.id })
        .eq("email", email);
        
      if (profileUpdateError) {
        console.error("Error updating profile ID:", profileUpdateError);
        console.log("Attempting to delete and recreate profile...");
        
        const { data: oldProfile } = await supabaseAdmin.from("profiles").select("*").eq("email", email).single();
        if (oldProfile) {
          await supabaseAdmin.from("profiles").delete().eq("email", email);
          const { error: insertError } = await supabaseAdmin.from("profiles").insert({
            ...oldProfile,
            id: authUser.id
          });
          if (insertError) console.error("Error recreating profile:", insertError);
          else console.log("Profile recreated with correct ID.");
        }
      } else {
        console.log("Profile ID updated successfully.");
      }
    }
  } else {
    console.log("User not found in Auth. Creating...");
    
    // Create user with the specific ID if possible, or just create and update profile
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      id: profileId, // Supabase allows providing an ID if it's a UUID
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: { display_name: "Administrador Geral" }
    });

    if (createError) {
      console.error("Error creating user:", createError);
      // Try creating without ID
      const { data: newUser2, error: createError2 } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true
      });
      
      if (createError2) {
        console.error("Error creating user without ID:", createError2);
      } else if (newUser2.user) {
        console.log(`User created with new ID: ${newUser2.user.id}`);
        // Update profile ID
        await supabaseAdmin.from("profiles").update({ id: newUser2.user.id }).eq("email", email);
        console.log("Profile ID updated.");
      }
    } else {
      console.log("User created successfully with profile ID.");
    }
  }
}

fixAdminAuth();
