import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  "https://hjzbswquepxrzozqipmh.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhqemJzd3F1ZXB4cnpvenFpcG1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMjQ0NjcsImV4cCI6MjA5MjkwMDQ2N30.hSeUfTHibAGgr0-ZtZiNQmxC-V8OfPY40gZpkTQACOk"
);

async function check() {
  const { data, error } = await supabase
    .from("pagamentos_venda")
    .select("*");

  if (error) console.error("Error:", error);
  console.log("Data:", JSON.stringify(data, null, 2));
}

check();
