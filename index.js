import express from 'express';
import dotenv from 'dotenv';
import pkg from 'pg';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';


// Load environment variables
dotenv.config();
const { Pool } = pkg;

// PostgreSQL setup
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false },
});

// Create the `apps` table if it doesn't exist
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

// AWS S3 setup
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Express setup
const app = express();
const port = process.env.PORT || 5000;
app.use(express.json());
const upload = multer({ dest: 'uploads/' });

// Convert __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Route: Test database connection
app.get('/db-test', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT column_name FROM information_schema.columns WHERE table_name = $1',
      ['apps']
    );
    res.json({ success: true, columns: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Database connection error', error: err.message });
  }
});

// Route: Submit form and store data
app.post('/submit-form', upload.single('file'), async (req, res) => {
  try {
    const { name, email, website, app_name } = req.body;

    // Insert data into the PostgreSQL database
    const result = await pool.query(
      'INSERT INTO apps (name, email, website, app_name) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, email, website, app_name]
    );

    res.json({
      success: true,
      message: 'Form submitted successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
  }
});

// Route: Get all submissions
app.get('/submission', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM apps');
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to retrieve submissions' });
  }
});

app.post('/generate-app', async (req, res) => {
  const { name, email, website, app_name } = req.body;

  if (!name || !email || !website || !app_name) {
    return res.status(400).json({ success: false, message: "All fields are required." });
  }

  try {
    // Path to `app.json`
    const appJsonPath = path.join(__dirname, 'app.json');

    // Update `app.json` dynamically
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf-8'));
    appJson.expo.name = app_name;
    appJson.expo.extra = { website }; // Add website to the extra field for Expo
    fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2));
    console.log("app.json updated successfully!");

    // Trigger EAS build
    exec('eas build --platform android --profile production', { cwd: __dirname }, (err, stdout, stderr) => {
      if (err) {
        console.error("Error during EAS build:", stderr);
        return res.status(500).json({ success: false, message: "EAS build failed.", error: stderr });
      }

      // Parse the build link
      const buildLinkMatch = stdout.match(/https:\/\/expo\.dev\/accounts\/.*\/builds\/[a-zA-Z0-9\-]+/);
      if (!buildLinkMatch) {
        return res.status(500).json({ success: false, message: "Failed to retrieve build link." });
      }

      const buildLink = buildLinkMatch[0];
      console.log("Build link:", buildLink);

      // Store app_url in the database
      pool.query(
        'UPDATE apps SET app_url = $1 WHERE website = $2 RETURNING *',
        [buildLink, website],
        (dbErr, dbResult) => {
          if (dbErr) {
            console.error("Database update error:", dbErr);
            return res.status(500).json({ success: false, message: "Failed to update database." });
          }

          res.json({ success: true, message: "App generated successfully!", link: buildLink });
        }
      );
    });
  } catch (error) {
    console.error("Error in generate-app:", error);
    res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
  }
});


// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
