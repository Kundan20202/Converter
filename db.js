const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'DATABASE_URL='',
  ssl: {
    rejectUnauthorized: false  // Adjust if you're encountering SSL verification errors
  }
});
module.exports = pool;
