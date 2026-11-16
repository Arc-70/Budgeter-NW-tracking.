// Supabase connection settings. Both values are safe to ship in the browser:
// data is protected by Row Level Security (see supabase/schema.sql).
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://glutwyferhlasgdimeyp.supabase.co'
export const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_KEY ?? 'sb_publishable_oQf-ZXkRLo7_5ecilf7VtQ_65prA91g'

export const isConfigured = !SUPABASE_URL.includes('YOUR-PROJECT')
