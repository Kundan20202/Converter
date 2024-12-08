import express from 'express';
import dotenv from 'dotenv';
import pkg from 'pg';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

dotenv.config();

const { Pool } = pkg; // PostgreSQL setup
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // For external DB connections
});

// Ensure the table exists
const createTableQuery = `
  CREATE TABLE IF NOT EXISTS apps (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    website VARCHAR(255) NOT NULL,
    app_name VARCHAR(255) NOT NULL,
    app_url TEXT,
    created_at TIMESTAMP DEFAULT NOW()
  );
`;

(async () => {
  try {
    await pool.query(createTableQuery);
    console.log("Table 'apps' ensured to exist.");
  } catch (err) {
    console.error("Error ensuring table creation:", err);
  }
})();

const app = express();
const port = process.env.PORT || 5000;
app.use(express.json());
const upload = multer({ dest: 'uploads/' });

// Dynamic app.json updater
function updateAppConfig(appName, website) {
  const config = {
    expo: {
      name: appName,
      slug: appName.toLowerCase().replace(/ /g, '-'),
      version: '1.0.0',
      orientation: 'portrait',
      platforms: ['ios', 'android'],
      entryPoint: './App.js',
      extra: { website },
    },
  };
  fs.writeFileSync('./app.json', JSON.stringify(config, null, 2));
}

// Utility function to parse EAS CLI output
function extractDownloadLink(output) {
  const regex = /https:\/\/expo\.dev\/artifacts\/.*?(?=\s|$)/;
  const match = output.match(regex);
  return match ? match[0] : null;
}

// Route: Generate app
app.post('/generate-app', async (req, res) => {
  const { name, email, website, app_name } = req.body;

  try {
    // Update app.json dynamically
    updateAppConfig(app_name, website);

    // Trigger EAS build
    exec('eas build --platform android --profile production', (error, stdout, stderr) => {
      if (error) {
        console.error(`Build Error: ${error.message}`);
        res.status(500).json({ success: false, message: 'Build failed' });
        return;
      }

      if (stderr) console.error(`Build STDERR: ${stderr}`);

      // Extract download link
      const downloadLink = extractDownloadLink(stdout);

      // Insert data into the database
      pool.query(
        'INSERT INTO apps (name, email, website, app_name, app_url) VALUES ($1, $2, $3, $4, $5)',
        [name, email, website, app_name, downloadLink],
        (dbErr, result) => {
          if (dbErr) {
            console.error(dbErr);
            res.status(500).json({ success: false, message: 'Database error' });
            return;
          }
          res.json({ success: true, app_url: downloadLink });
        }
      );
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to generate app' });
  }
});

// Route: View submissions
app.get('/submission', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM apps');
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to retrieve submissions' });
  }
});

// Route: Test DB connection
app.get('/db-test', async (req, res) => {
  try {
    const result = await pool.query('SELECT column_name FROM information_schema.columns WHERE table_name = $1', ['apps']);
    res.json({ success: true, columns: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Database connection error', error: err.message });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
