const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Test database connection
pool.connect((err) => {
  if (err) {
    console.error('Database connection error:', err.stack);
  } else {
    console.log('Connected to the database!');
  }
});

// Generate download links
const generateLinks = (appId) => {
  const baseURL = 'https://example-apps.s3.amazonaws.com'; // Replace with your storage URL
  return {
    android: `${baseURL}/${appId}/android.apk`,
    ios: `${baseURL}/${appId}/ios.ipa`,
  };
};

// Routes

// Submit form data
app.post('/submit', async (req, res) => {
  const { appName, website, appType } = req.body;

  if (!appName || !website || !appType) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const appId = uuidv4(); // Unique identifier for the app
    const links = generateLinks(appId);

    const result = await pool.query(
      `INSERT INTO submissions (app_name, website, app_type, app_id, android_link, ios_link) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [appName, website, appType, appId, links.android, links.ios]
    );

    console.log('Data inserted:', result.rows[0]);
    res.status(201).json({
      message: 'Form submitted successfully',
      links,
    });
  } catch (error) {
    console.error('Error saving data:', error);
    res.status(500).json({ message: 'Failed to save data' });
  }
});

// Retrieve submissions
app.get('/submissions', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM submissions ORDER BY created_at DESC');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({ message: 'Failed to fetch data' });
  }
});

// Root endpoint for testing
app.get('/', (req, res) => {
  res.send('Backend is working!');
});

// Start server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
