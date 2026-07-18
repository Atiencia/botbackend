import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase
    .from('knowledge')
    .insert([{ botId: 'eli-default-bot', category: 'test', content: 'test' }])
    .select();
  console.log('Error:', error);
  console.log('Data:', data);
}
test();
