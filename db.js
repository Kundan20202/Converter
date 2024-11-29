const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://web_to_app_db_user:qFqUzCUmLZ8KHYZmCdECNnUfjtV82pdP@dpg-ct4buaggph6c73c6fatg-a/web_to_app_db',
  ssl: {
    rejectUnauthorized: false, // Required for Render
  },
});

module.exports = pool;
