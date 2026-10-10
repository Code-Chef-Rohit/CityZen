import fs from 'fs';
import path from 'path';

// Simple lightweight environment loader
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
        if (!process.env[key]) process.env[key] = value.trim();
      }
    });
  }
}

loadEnv();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY missing from environment or .env file.');
  process.exit(1);
}

console.log(`🌐 Pinging Supabase project at ${supabaseUrl}...`);

fetch(`${supabaseUrl}/rest/v1/profiles?select=id&limit=1`, {
  headers: {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`
  }
})
  .then(res => {
    if (res.ok) {
      console.log(`✅ Success! Supabase responded with status ${res.status}. Project active.`);
    } else {
      console.warn(`⚠️ Warning: Supabase responded with status ${res.status}`);
    }
  })
  .catch(err => {
    console.error('❌ Error pinging Supabase:', err.message);
    process.exit(1);
  });
