import express from 'express';
import dotenv from 'dotenv';
import pkg from 'pg'; // PostgreSQL
import multer from 'multer'; // File uploads
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Load environment variables
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

// Initialize Express
const app = express();
const port = process.env.PORT || 5000;
app.use(express.json());
const upload = multer({ dest: 'uploads/' });

// AWS S3 setup
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

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

// Route: Submit form
app.post('/submit-form', upload.single('file'), async (req, res) => {
  try {
    const { name, website, app_name, email } = req.body;

    // Insert data into PostgreSQL database
    const result = await pool.query(
      'INSERT INTO apps (name, website, app_name, email) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, website, app_name, email]
    );

    // File upload to S3 (if file exists)
    let fileUrl = '';
    if (req.file) {
      const fileContent = fs.readFileSync(req.file.path);
      const fileName = `${Date.now()}_${req.file.originalname}`;

      await s3.send(
        new PutObjectCommand({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: fileName,
          Body: fileContent,
          ContentType: req.file.mimetype,
        })
      );

      fileUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
      fs.unlinkSync(req.file.path); // Clean up local file
    }

    res.json({
      success: true,
      message: 'Form submitted successfully',
      data: result.rows[0],
      fileUrl: fileUrl,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// Route: Generate app using EAS
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
        (dbErr) => {
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

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
