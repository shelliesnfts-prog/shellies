const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env file manually
const envPath = path.join(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};

envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function addBlockchainFailedEnum() {
  try {
    console.log('🚀 Adding BLOCKCHAIN_FAILED to raffle_status enum...');
    
    // First check if the enum value already exists
    const checkQuery = `
      SELECT EXISTS (
        SELECT 1 FROM pg_enum 
        JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
        WHERE pg_type.typname = 'raffle_status' 
        AND pg_enum.enumlabel = 'BLOCKCHAIN_FAILED'
      ) as exists;
    `;
    
    const { data: checkResult, error: checkError } = await supabase
      .rpc('exec_sql', { sql: checkQuery });
    
    if (checkError) {
      console.log('⚠️ Cannot check enum status, proceeding with addition...');
    } else if (checkResult && checkResult[0]?.exists) {
      console.log('✅ BLOCKCHAIN_FAILED enum value already exists');
      return;
    }
    
    // Add the enum value
    const addEnumQuery = `ALTER TYPE raffle_status ADD VALUE IF NOT EXISTS 'BLOCKCHAIN_FAILED';`;
    
    const { error } = await supabase.rpc('exec_sql', { sql: addEnumQuery });
    
    if (error) {
      console.error('❌ Error adding enum value:', error);
      console.log('');
      console.log('⚠️  Please run this SQL manually in your Supabase SQL editor:');
      console.log('   ALTER TYPE raffle_status ADD VALUE IF NOT EXISTS \'BLOCKCHAIN_FAILED\';');
      console.log('');
      return;
    }
    
    console.log('✅ Successfully added BLOCKCHAIN_FAILED to raffle_status enum');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    console.log('');
    console.log('⚠️  Please run this SQL manually in your Supabase SQL editor:');
    console.log('   ALTER TYPE raffle_status ADD VALUE IF NOT EXISTS \'BLOCKCHAIN_FAILED\';');
    console.log('');
  }
}

addBlockchainFailedEnum();