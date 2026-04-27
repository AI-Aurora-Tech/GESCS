import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL || "", process.env.SUPABASE_SERVICE_ROLE_KEY || "");

async function testInsert() {
  const table = 'products';
  const dummy = {
    name: 'TEST_PRODUCT',
    barcode: '1234567890',
    size: 'M',
    purchase_price: 10,
    sale_price: 15,
    price: 15,
    stock: 1,
    category: 'Uniforme'
  };
  
  const { data, error } = await supabaseAdmin.from(table).insert([dummy]).select();
  if (error) {
    console.log("Insert Error:", JSON.stringify(error, null, 2));
  } else {
    console.log("Insert OK:", data);
    // Delete the test product
    if (data && data[0]) {
      await supabaseAdmin.from(table).delete().eq('id', data[0].id);
      console.log("Cleanup OK");
    }
  }
}

testInsert();
