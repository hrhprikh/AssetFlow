const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY // I will pass this via env var

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing supabaseUrl or serviceRoleKey")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const testUsers = [
  { email: 'admin@admin.com', role: 'ADMIN', name: 'Test Admin' },
  { email: 'manager@admin.com', role: 'ASSET_MANAGER', name: 'Test Manager' },
  { email: 'head@admin.com', role: 'DEPARTMENT_HEAD', name: 'Test Head' },
  { email: 'employee@admin.com', role: 'EMPLOYEE', name: 'Test Employee' }
]

async function seed() {
  for (const user of testUsers) {
    console.log(`Creating ${user.email}...`)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: user.email,
      password: 'test123',
      email_confirm: true,
      user_metadata: { name: user.name }
    })

    if (authError) {
      if (authError.message.includes('already registered')) {
        console.log(`- User ${user.email} already exists. Attempting to update role...`)
        // Find user by email to get ID
        const { data: listData } = await supabase.auth.admin.listUsers()
        const existing = listData?.users.find(u => u.email === user.email)
        if (existing) {
          const { error: profileError } = await supabase.from('profiles').update({ role: user.role }).eq('id', existing.id)
          if (profileError) console.error("Error updating profile role:", profileError.message)
          else console.log(`- Updated role to ${user.role}`)
        }
      } else {
        console.error("Auth error:", authError.message)
      }
    } else {
      console.log(`- Created successfully! Waiting 1s for trigger to run...`)
      // Wait for trigger to create the profile
      await new Promise(r => setTimeout(r, 1000))
      const { error: profileError } = await supabase.from('profiles').update({ role: user.role }).eq('id', authData.user.id)
      if (profileError) {
        console.error("Error updating profile role:", profileError.message)
      } else {
        console.log(`- Updated role to ${user.role}`)
      }
    }
  }
  console.log("Done!")
}

seed()
