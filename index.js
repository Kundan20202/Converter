import express from 'express';
import dotenv from 'dotenv';
import pkg from 'pg';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import multer from 'multer';
import winston from 'winston';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Load environment variables
dotenv.config();
const { Pool } = pkg;

// PostgreSQL setup
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false },
});

// Create the apps table if it doesn't exist
const createTableQuery = `
  CREATE TABLE IF NOT EXISTS apps (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    website VARCHAR(255) NOT NULL,
    app_name VARCHAR(255) NOT NULL,
    app_url TEXT,
    s3_url TEXT,
    created_at TIMESTAMP DEFAULT NOW()
  );
`;

(async () => {
  try {
    await pool.query(createTableQuery);
    logger.info("Table 'apps' ensured to exist.");
  } catch (err) {
    logger.error("Error ensuring table creation:", err);
  }
})();

// AWS S3 setup
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'server.log' }),
    new winston.transports.Console(),
  ],
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
    logger.error("Database connection error:", err);
    res.status(500).json({ success: false, message: 'Database connection error', error: err.message });
  }
});

// Route: Submit form and store data
app.post('/submit-form', upload.single('file'), async (req, res) => {
  try {
    logger.info("Form submission received with data:", req.body);

    const { name, email, website, app_name } = req.body;
    const file = req.file;

    // Validate file upload
    if (!file) {
      logger.error("No file provided in form submission.");
      return res.status(400).json({ success: false, message: "File is required." });
    }

    // Upload file to AWS S3
    const s3Params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: `${Date.now()}_${file.originalname}`,
      Body: fs.createReadStream(file.path),
      ContentType: file.mimetype,
    };

    const s3Command = new PutObjectCommand(s3Params);
    const s3Response = await s3Client.send(s3Command);

    logger.info("File uploaded to S3 successfully:", s3Response);

    // Remove the file from local uploads after S3 upload
    fs.unlinkSync(file.path);

    const s3Url = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Params.Key}`;

    // Insert data into the PostgreSQL database
    const result = await pool.query(
      'INSERT INTO apps (name, email, website, app_name, s3_url) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, email, website, app_name, s3Url]
    );

    logger.info("Database insertion successful:", result.rows[0]);

    res.json({
      success: true,
      message: 'Form submitted successfully',
      data: result.rows[0],
    });
  } catch (error) {
    logger.error("Error in /submit-form:", error);
    res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
  }
});

// Route: Get all submissions
app.get('/submission', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM apps');
    res.json(result.rows);
  } catch (error) {
    logger.error("Error retrieving submissions:", error);
    res.status(500).json({ success: false, message: 'Failed to retrieve submissions' });
  }
});

// Route: Fetch logs
app.get('/logs', (req, res) => {
  const logFilePath = path.join(__dirname, 'server.log');

  if (fs.existsSync(logFilePath)) {
    res.sendFile(logFilePath);
  } else {
    res.status(404).send('Log file not found.');
  }
});

// Start the server
app.listen(port, () => {
  logger.info(`Server is running on port ${port}`);
});
