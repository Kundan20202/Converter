const express = require('express');
const { Pool } = require('pg');
const AWS = require('aws-sdk');
const multer = require('multer');
const path = require('path');
require('dotenv').config();

// Create express app
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set up PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Set up AWS S3
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();

// Set up multer for file handling (assume we are uploading a zip file)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Endpoint to submit form and upload to S3
app.post('/submit', upload.single('appFile'), async (req, res) => {
  const { appName, website, email } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    // Upload file to AWS S3
    const fileName = `${appName}-${Date.now()}.zip`; // Generate a unique name
    const uploadParams = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: fileName,
      Body: req.file.buffer,
      ContentType: 'application/zip',
      ACL: 'public-read',
    };

    const uploadResult = await s3.upload(uploadParams).promise();

    // Save submission to PostgreSQL
    const client = await pool.connect();
    try {
      const query = 'INSERT INTO submissions(app_name, website, email, app_link) VALUES($1, $2, $3, $4) RETURNING *';
      const values = [appName, website, email, uploadResult.Location];

      const result = await client.query(query, values);
      client.release();

      // Send back the response with the app link
      res.json({ message: 'App uploaded successfully', downloadLink: uploadResult.Location });
    } catch (error) {
      client.release();
      console.error('Error saving to database:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  } catch (error) {
    console.error('Error uploading file to S3:', error);
    res.status(500).json({ error: 'Failed to upload file to S3' });
  }
});

// Endpoint to check all submissions (for testing)
app.get('/submissions', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT * FROM submissions');
    client.release();
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

// Listen on the specified port
app.listen(process.env.PORT, () => {
  console.log(`Server is running on port ${process.env.PORT}`);
});
