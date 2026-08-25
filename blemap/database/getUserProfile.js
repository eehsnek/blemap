// database/getUserProfile.js
import { supabase } from './supabase.js'

export async function getCurrentUserProfile() {
  // Get the currently authenticated user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  if (!user) return null

  // Query the profiles table, joining with roles
  const { data: users, error: profileError } = await supabase
    .from('users')
    .select('username')
    .eq('id', user.id)
    .single()

  if (profileError) throw profileError
  return users
}

const { data, error } = await supabase
  .from('users')
  .select('username')
  .eq('id', '88ec5a7b-9733-49cb-ae42-65c49aa445b1')

if (error) {
  console.error(error)
} else {
  console.log(data)
}
