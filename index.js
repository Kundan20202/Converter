const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const port = process.env.PORT || 5000;

// Enable CORS
app.use(cors());

// Middleware to parse JSON body
app.use(bodyParser.json());

// Handle POST request for form submission
app.post('/submit', (req, res) => {
  const { appName, website, appType } = req.body;

  // Validation - Ensure all fields are provided
  if (!appName || !website || !appType) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  // Log the received data (you can process/store it as needed)
  console.log('Received form data:', req.body);

  // Respond with success message
  return res.status(200).json({ message: 'Form submitted successfully!' });
});

// Start the server
app.listen(port, () => {
  console.log(`Backend running at http://localhost:${port}`);
});
