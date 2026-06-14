import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://dyhipotqmnfylpigffiq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5aGlwb3RxbW5meWxwaWdmZmlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0MDk5ODAsImV4cCI6MjA5Njk4NTk4MH0.282sR2tpkTwnh5emDk72coOaQTIbVV0O-gh28-FDoY4'
)
