import express from 'express';
import dotenv from 'dotenv';
import pkg from 'pg';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import cors from 'cors';
import bodyParser from 'body-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';


// Load environment variables
dotenv.config();
const { Pool } = pkg;

// PostgreSQL setup
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("localhost")
    ? { rejectUnauthorized: false }
    : false,
});


// Create the `apps` table if it doesn't exist
const createTableQuery = `
  CREATE TABLE IF NOT EXISTS apps (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    website VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    app_name VARCHAR(255) NOT NULL,
    app_url TEXT,
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
const upload = multer({ dest: 'uploads/' });

// Convert __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const schemaPath = path.join(__dirname, 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');

(async () => {
  try {
    await pool.query(schema);
    console.log("Schema applied successfully.");
  } catch (err) {
    console.error("Error applying schema:", err);
  }
})();

// Middleware to protect routes

const verifyToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ message: 'Invalid or expired token' });
        }
        req.userId = decoded.userId;
        next();
    });
};

export default verifyToken;




// Route: Test database connection
app.get('/db-test', async (req, res) => {
  try {
    // Test query to check if the database is connected
    const result = await pool.query(
      'SELECT column_name FROM information_schema.columns WHERE table_name = $1',
      ['apps']
    );
    res.json({ success: true, message: 'Database connected successfully!', columns: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Database connection error', error: err.message });
  }
});


// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));




// Root Route
app.get('/', (req, res) => {
    res.send('Backend is running!');
});



// Registering a New User
app.post('/api/register', async (req, res) => {
  const { name, email, website, password } = req.body;

  if (!name || !email || !website || !password) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  try {
    // Check if email already exists
    const emailCheckResult = await pool.query('SELECT * FROM apps WHERE email = $1', [email]);

    if (emailCheckResult.rows.length > 0) {
      return res.status(400).json({ message: 'Email already exists.' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert the new user into the database
    const result = await pool.query(
      `INSERT INTO apps (name, email, website, app_name, password) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, email, website, 'DefaultAppName', hashedPassword]
    );

    // Get the newly created user's data
    const user = result.rows[0];

    // Generate a JWT token with the userId (No expiration to make it a long-lasting token)
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET);

    // Send the response with the token and user details
    res.status(201).json({
      message: 'Registration successful!',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        website: user.website,
      },
      token, // Send the token along with the user data
    });

  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).json({ message: 'Registration failed.', error: error.message });
  }
});

// Route: Update Situation
app.post('/api/update-situation', verifyToken, async (req, res) => {
    try {
        const { situation } = req.body;

        // Validate input
        if (!situation) {
            return res.status(400).json({ message: 'Situation is required.' });
        }

        // Allowed values for the situation
        const allowedSituations = [
            'growing business.',
            'established business.',
            'just getting started',
        ];

        // Check if the provided situation is valid
        if (!allowedSituations.includes(situation)) {
            return res.status(400).json({ message: 'Invalid situation value.' });
        }

        // Update the situation column in the database
        const result = await pool.query(
            'UPDATE apps SET situation = $1 WHERE id = $2 RETURNING *',
            [situation, req.userId]
        );

        // Check if a row was updated
        if (result.rowCount === 0) {
            return res.status(400).json({ message: 'No updates were made. User may not exist.' });
        }

        res.status(200).json({
            message: 'Situation updated successfully!',
            user: result.rows[0], // Returning the updated user data
        });
    } catch (error) {
        console.error('Error updating situation:', error);
        res.status(500).json({ message: 'Failed to update situation.', error: error.message });
    }
});


// User login route (POST)
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    try {
        const result = await pool.query('SELECT * FROM apps WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user) {
            return res.status(400).json({ message: 'User not found' });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Create JWT token
        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' }); // Token expires in 1 hour
        res.status(200).json({ message: 'Login successful', token });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});


// Update Company Details
app.post('/api/update-company-details', verifyToken, async (req, res) => {
    const { app_name, app_type, visitors, country } = req.body;

    // Check if at least one field is provided
    if (!app_name && !app_type && !visitors && !country) {
        return res.status(400).json({ message: 'At least one field must be provided for update.' });
    }

    try {
        // Construct the dynamic query
        const fields = [];
        const values = [];
        let fieldIndex = 1;

        if (app_name) {
            fields.push(`app_name = $${fieldIndex++}`);
            values.push(app_name);
        }
        if (app_type) {
            fields.push(`app_type = $${fieldIndex++}`);
            values.push(app_type);
        }
        if (visitors) {
            fields.push(`visitors = $${fieldIndex++}`);
            values.push(visitors);
        }
        if (country) {
            fields.push(`country = $${fieldIndex++}`);
            values.push(country);
        }

        // Append userId for the WHERE clause
        values.push(req.userId);

        // Join fields for the SET clause
        const query = `
            UPDATE apps
            SET ${fields.join(', ')}
            WHERE id = $${fieldIndex}
            RETURNING *;
        `;

        // Execute the query
        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found or no changes made.' });
        }

        // Respond with the updated user details
        res.status(200).json({
            message: 'Company details updated successfully.',
            user: result.rows[0],
        });
    } catch (error) {
        console.error('Error updating company details:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
});





// GET USERS

app.get('/api/users', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM apps');
        if (result.rows.length === 0) {
            return res.json({
                message: 'No users found.',
                users: [],
            });
        }
        res.json({
            message: 'Users fetched successfully!',
            users: result.rows,
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({
            message: 'Failed to fetch users.',
            error: error.message,
        });
    }
});





// Route: Submit form and store data
app.post('/submit-form', upload.single('file'), async (req, res) => {
  try {
    const { name, email, website, app_name } = req.body;

    // Insert data into the PostgreSQL database
    const result = await pool.query(
      'INSERT INTO apps (name, email, website, app_name) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, email, website, app_name]
    );

    res.json({
      success: true,
      message: 'Form submitted successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
  }
});

// Route: Get all submissions
app.get('/submission', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM apps');
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to retrieve submissions' });
  }
});

// Route: Generate App (Trigger EAS Build)
app.post('/generate-app', async (req, res) => {
  const { name, website } = req.body;

  if (!name || !website) {
    return res.status(400).json({ success: false, message: "Name and website are required." });
  }

  try {
    // Path to `app.json`
    const appJsonPath = path.join(__dirname, 'app.json');

    // Read and update `app.json`
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf-8'));
    appJson.expo.name = name;
    appJson.expo.extra = { website }; // Add extra field for website
    fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2));

    console.log("app.json updated successfully!");

    // Trigger EAS build
    exec('eas build --platform android --profile production', { cwd: __dirname }, (err, stdout, stderr) => {
      if (err) {
        console.error("Error during EAS build:", stderr);
        return res.status(500).json({ success: false, message: "EAS build failed.", error: stderr });
      }

      // Parse EAS build response
      const buildLinkMatch = stdout.match(/https:\/\/expo\.dev\/accounts\/.*\/builds\/[a-zA-Z0-9\-]+/);
      if (!buildLinkMatch) {
        return res.status(500).json({ success: false, message: "Failed to retrieve build link." });
      }

      const buildLink = buildLinkMatch[0];
      console.log("Build link:", buildLink);

      // Store app_url in the database
      pool.query(
        'UPDATE apps SET app_url = $1 WHERE website = $2 RETURNING *',
        [buildLink, website],
        (dbErr, dbResult) => {
          if (dbErr) {
            console.error("Database update error:", dbErr);
            return res.status(500).json({ success: false, message: "Failed to update database." });
          }

          // Return the app download link
          res.json({ success: true, message: "App generated successfully!", link: buildLink });
        }
      );
    });
  } catch (error) {
    console.error("Error in generate-app:", error);
    res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
