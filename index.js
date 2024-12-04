// Import required modules
import express from 'express';
import dotenv from 'dotenv';
import multer from 'multer';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import { Pool } from 'pg';

// Load environment variables
dotenv.config();

// Initialize the Express app
const app = express();
const port = process.env.PORT || 5000;

// Initialize PostgreSQL pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Initialize S3 client
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// POST route to handle form submission
app.post('/submit', upload.single('file'), async (req, res) => {
  try {
    // Extract form data
    const { appName, website, appType } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    // Generate unique file name using UUID
    const fileName = `${uuidv4()}-${req.file.originalname}`;

    // Upload file to S3
    const uploadParams = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: fileName,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    };

    // Upload the file to S3
    const command = new PutObjectCommand(uploadParams);
    await s3.send(command);

    // Store submission info in the database
    const client = await pool.connect();
    await client.query(
      'INSERT INTO submissions(app_name, website, app_type, s3_file_url) VALUES($1, $2, $3, $4)',
      [appName, website, appType, `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`]
    );
    client.release();

    // Respond with success
    return res.status(200).json({
      message: 'Form submitted successfully!',
      appUrl: `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`,
    });
  } catch (error) {
    console.error('Error submitting form:', error);
    return res.status(500).json({ error: 'Error submitting form. Please try again later.' });
  }
});

// Route to view submissions
app.get('/submission', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT * FROM submissions');
    client.release();

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({ error: 'Error fetching submissions.' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
