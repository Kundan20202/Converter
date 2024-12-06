import express from 'express';
import dotenv from 'dotenv';
import pkg from 'pg'; // Fixed import for CommonJS
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

const { Pool } = pkg; // Destructure from CommonJS import

// PostgreSQL setup
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, 
  },
});


const createTableQuery = `
  DROP TABLE IF EXISTS apps;
  CREATE TABLE apps (
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
    console.log("Table 'apps' dropped and recreated successfully.");
  } catch (err) {
    console.error("Error recreating table:", err);
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

// Handle file uploads
const upload = multer({ dest: 'uploads/' });

// Convert __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Route: Database test
app.get('/db-test', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT column_name FROM information_schema.columns WHERE table_name = $1',
      ['apps']
    );
    res.json({ success: true, columns: result.rows });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ success: false, message: 'Database connection error', error: err.message });
  }
});

// Route: Form submission
app.post('/submit-form', upload.single('file'), async (req, res) => {
  try {
    const { name, email, website, app_name } = req.body;


// Insert data into the PostgreSQL database
const result = await pool.query(
  'INSERT INTO apps (name, website, app_name, email) VALUES ($1, $2, $3, $4) RETURNING *',
  [name, website, app_name, email]
);


    // File upload to S3
    let fileUrl = '';
    if (req.file) {
      const fileContent = fs.readFileSync(req.file.path);
      const fileName = `${Date.now()}_${req.file.originalname}`;

      const uploadResult = await s3.send(
        new PutObjectCommand({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: fileName,
          Body: fileContent,
          ContentType: req.file.mimetype,
        })
      );

      fileUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
      fs.unlinkSync(req.file.path); // Clean up local file

      // Update app_url in the database
      await pool.query('UPDATE apps SET app_url = $1 WHERE id = $2', [fileUrl, result.rows[0].id]);
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

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
