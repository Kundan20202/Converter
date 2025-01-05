const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'DATABASE_URL=postgresql://converter_owner:YW4ieXoLaO1U@ep-twilight-cell-a5105fe9.us-east-2.aws.neon.tech/converter?sslmode=require',
  ssl: {
    rejectUnauthorized: false  // Adjust if you're encountering SSL verification errors
  }
});
module.exports = pool;
