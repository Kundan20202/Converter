// db.js
const { Client } = require('pg');

// Connection string from Render
const client = new Client({
  connectionString: 'postgresql://web_to_app_db_user:qFqUzCUmLZ8KHYZmCdECNnUfjtV82pdP@dpg-ct4buaggph6c73c6fatg-a.oregon-postgres.render.com/web_to_app_db', // Replace with the Render connection string
  ssl: {
    rejectUnauthorized: false
  }
});

client.connect()
  .then(() => {
    console.log("PostgreSQL connected!");
  })
  .catch(err => {
    console.error("Connection error", err.stack);
  });

module.exports = client;
