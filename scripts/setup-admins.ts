import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const admins = [
  { name: 'Edson Kawakami', username: 'edson_kawakami', password: 'Admin123', role: 'admin_geral' },
  { name: 'Pedro Santos', username: 'pedro_santos', password: 'Admin123', role: 'admin_geral' },
  { name: 'Viviane Oliveira', username: 'viviane_oliveira', password: 'Admin123', role: 'admin_geral' },
  { name: 'Juliana Santos', username: 'juliana_santos', password: 'Admin123', role: 'admin_geral' }
];

async function setupAdmins() {
  console.log('Iniciando criação de administradores...');

  // 1. Ensure the requires_password_change column exists
  try {
    await supabaseAdmin.rpc('add_requires_password_change_column');
    // If RPC fails, we assume the user will run the SQL script provided in the chat
  } catch (e) {
    console.log('Aviso: Certifique-se de executar o script SQL para adicionar a coluna requires_password_change.');
  }

  for (const admin of admins) {
    const email = `${admin.username.toLowerCase().trim()}@scouts.local`;
    
    console.log(`Criando usuário: ${admin.username}...`);
    
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: admin.password,
      email_confirm: true,
      user_metadata: {
        display_name: admin.name
      }
    });

    if (authError) {
      if (authError.message.includes('already exists') || authError.message.includes('already been registered')) {
        console.log(`Usuário ${admin.username} já existe. Atualizando perfil...`);
        // Fetch user to update profile
        const { data } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = (data?.users as any[])?.find(u => u.email === email);
        if (existingUser) {
          await updateProfile(existingUser.id, admin);
        }
      } else {
        console.error(`Erro ao criar ${admin.username}:`, authError.message);
      }
    } else if (authData.user) {
      await updateProfile(authData.user.id, admin);
      console.log(`Usuário ${admin.username} criado com sucesso!`);
    }
  }
  
  console.log('Finalizado!');
}

async function updateProfile(userId: string, admin: any) {
  const email = `${admin.username.toLowerCase().trim()}@scouts.local`;
  const { error } = await supabaseAdmin.from('profiles').upsert({
    id: userId,
    email: email,
    display_name: admin.name,
    role: admin.role,
    requires_password_change: true
  });

  if (error) {
    console.error(`Erro ao atualizar perfil de ${admin.username}:`, error.message);
  }
}

setupAdmins();
