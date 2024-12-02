// Consolidated backend code for Render's PostgreSQL database and AWS S3 integration.

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const AWS = require('aws-sdk');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// PostgreSQL configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // For secure connections in Render
});

// AWS S3 configuration
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// Endpoint to test DB connection
app.get('/db-test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.status(200).send(`Database connection is active. Server time: ${result.rows[0].now}`);
  } catch (err) {
    console.error('Database connection test failed:', err);
    res.status(500).send('Database connection test failed.');
  }
});

// Endpoint to view all submissions
app.get('/submission', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM submissions ORDER BY created_at DESC');
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error fetching submissions:', err);
    res.status(500).send('Error fetching submissions.');
  }
});

// Endpoint to handle form submission and generate app link
app.post('/submit-form', async (req, res) => {
  const { name, website, appName } = req.body;

  if (!name || !website || !appName) {
    return res.status(400).send('All fields are required.');
  }

  try {
    // Generate an app package (mocking with placeholder for now)
    const appPackageContent = `App for ${appName} generated from ${website}`;
    const key = `${Date.now()}-${appName}.txt`;

    const params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
      Body: appPackageContent,
    };

    const uploadResponse = await s3.upload(params).promise();
    const appLink = uploadResponse.Location;

    // Save submission to database
    const query = `
      INSERT INTO submissions (name, website, app_name, app_link, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING *;
    `;
    const values = [name, website, appName, appLink];
    const result = await pool.query(query, values);

    res.status(201).json({ message: 'Submission successful!', appLink: result.rows[0].app_link });
  } catch (err) {
    console.error('Error handling form submission:', err);
    res.status(500).send('Failed to handle submission. Please try again.');
  }
});

// Starting the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
