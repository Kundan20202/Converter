require('dotenv').config(); // Load environment variables
const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3'); // AWS SDK v3 S3 client

// Express app setup
const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Multer setup for file uploads
const upload = multer({ dest: 'uploads/' }); // Temporary folder for uploads

// Initialize AWS S3 client
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Endpoint to handle form submissions
app.post('/submit', async (req, res) => {
  const { appName, website, appType } = req.body;

  try {
    // **Simulating app generation process**
    const generatedFilePath = path.join(__dirname, 'generatedApps', `${appName}.apk`); // Dummy file path
    fs.writeFileSync(generatedFilePath, 'Dummy app content'); // Create a dummy file for testing

    // Upload to S3
    const fileKey = `apps/${appName}-${Date.now()}.apk`; // Dynamic S3 file name
    const fileContent = fs.readFileSync(generatedFilePath);

    const params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: fileKey, // File name in S3
      Body: fileContent,
      ContentType: 'application/octet-stream',
    };

    // Use the PutObjectCommand to upload
    const uploadCommand = new PutObjectCommand(params);
    const uploadResult = await s3.send(uploadCommand);

    // Construct file URL
    const fileUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileKey}`;

    // Send back the file URL to the user
    res.status(200).json({
      message: 'App generated and uploaded successfully',
      appLink: fileUrl,
    });

    // Clean up the temporary file
    fs.unlinkSync(generatedFilePath);
  } catch (error) {
    console.error('Error handling submission:', error);
    res.status(500).json({ message: 'An error occurred', error });
  }
});

// Endpoint to view submissions (assuming it's reading from memory or storage)
app.get('/submissions', async (req, res) => {
  try {
    // Logic to fetch submission details
    const submissions = []; // Replace with actual data retrieval logic
    res.status(200).json({ submissions });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({ message: 'Failed to fetch submissions', error });
  }
});

// Server setup
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
