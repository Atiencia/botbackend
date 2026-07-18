import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { logger } from './logger';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || ''; // Must be service_role key

if (!supabaseUrl || !supabaseKey) {
  logger.error('Faltan las variables de entorno SUPABASE_URL o SUPABASE_KEY en el backend.');
}

// We use the service_role key to bypass RLS in the backend. 
// Frontend requests will be verified via their own JWT tokens.
export const supabase = createClient(supabaseUrl, supabaseKey);
