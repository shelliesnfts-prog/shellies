const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function runMigration() {
  try {
    console.log('🚀 Running migration: Add BLOCKCHAIN_FAILED status');
    
    const migrationPath = path.join(__dirname, '../migrations/021_add_blockchain_failed_status.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📝 Migration SQL:', migrationSQL);
    
    // Execute the migration
    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });
    
    if (error) {
      console.error('❌ Error running migration:', error);
      // Try alternative method - direct query execution
      console.log('🔄 Trying alternative method...');
      
      const { data: altData, error: altError } = await supabase
        .from('information_schema.user_defined_types')
        .select('*');
      
      if (altError) {
        console.error('❌ Alternative method failed:', altError);
        console.log('⚠️ Please run the migration manually in your Supabase SQL editor:');
        console.log(migrationSQL);
        process.exit(1);
      }
    } else {
      console.log('✅ Migration completed successfully');
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    console.log('⚠️ Please run the migration manually in your Supabase SQL editor:');
    const migrationPath = path.join(__dirname, '../migrations/021_add_blockchain_failed_status.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log(migrationSQL);
  }
}

runMigration();