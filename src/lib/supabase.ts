import { createClient } from '@supabase/supabase-js'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config'

// Single shared client. The session is stored on the device, so the PIN is
// only typed once per phone/PC.
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
