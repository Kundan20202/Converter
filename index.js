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
});

const createTableQuery = `
    CREATE TABLE IF NOT EXISTS apps (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        ALTER TABLE apps ADD COLUMN website VARCHAR(255);
        app_name VARCHAR(255) NOT NULL, -- Changed email to app_name as per endpoint
        app_url TEXT NOT NULL,
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

// Handle file uploads
const upload = multer({ dest: 'uploads/' });

// Convert __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Route: Form submission
app.post('/submit-form', upload.single('file'), async (req, res) => {
  try {
    const { name, website, app_name } = req.body;

    // Insert data into the PostgreSQL database
    const result = await pool.query(
      'INSERT INTO apps (name, website, app_name) VALUES ($1, $2, $3) RETURNING *',
      [name, website, app_name]
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
