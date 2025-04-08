import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

export interface ScrapingUrl {
  id: number;
  url: string;
  created_at: string;
  updated_at: string;
} 