// Import necessary modules
const express = require('express');
const dotenv = require('dotenv');
const { Pool } = require('pg');  // Using 'require' for PostgreSQL module
const aws = require('@aws-sdk/client-s3');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// Load environment variables
dotenv.config();

// Initialize AWS S3 client
const s3 = new aws.S3({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Initialize PostgreSQL pool connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Initialize Express app
const app = express();
const port = process.env.PORT || 5000;

// Middleware for parsing JSON bodies and handling file uploads
app.use(express.json());
const upload = multer({ dest: 'uploads/' });

// Route for handling form submission
app.post('/submit-form', upload.single('file'), async (req, res) => {
  try {
    const { name, website, app_name } = req.body;

    // Save data to PostgreSQL database
    const result = await pool.query(
      'INSERT INTO apps (name, website, app_name) VALUES ($1, $2, $3) RETURNING *',
      [name, website, app_name]
    );

    // If file is uploaded, upload it to S3
    let fileUrl = '';
    if (req.file) {
      const fileContent = fs.readFileSync(req.file.path);
      const fileName = `${Date.now()}_${req.file.originalname}`;

      // Upload to S3 bucket
      const uploadResult = await s3.putObject({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: fileName,
        Body: fileContent,
        ContentType: req.file.mimetype,
      });

      fileUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
      fs.unlinkSync(req.file.path);  // Remove the file from local storage after upload
    }

    // Respond with the submitted data and file URL
    res.json({
      success: true,
      message: 'Form submitted successfully',
      data: result.rows[0],  // Return inserted data
      fileUrl: fileUrl,  // Return file URL if uploaded
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// Route for viewing submissions (data stored in PostgreSQL)
app.get('/submission', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM apps');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to retrieve submissions' });
  }
});

// Start the Express server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
