import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  "https://yluwfphzawqnxbinijji.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsdXdmcGh6YXdxbnhiaW5pamppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNzAyNDAsImV4cCI6MjA5MDc0NjI0MH0.ruF2WN8RVn0TjqSSjA5X7DTffPVanm7tGjF5EJ1QsAU"
);

async function check() {
  const { data, error } = await supabase
    .from("pagamentos_venda")
    .select("*");

  if (error) console.error("Error:", error);
  console.log("Data:", JSON.stringify(data, null, 2));
}

check();
