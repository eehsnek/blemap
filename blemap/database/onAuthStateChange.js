import { supabase } from './supabase.js'

export function listenAuthChanges(callback) {
  supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session)
  })
}
