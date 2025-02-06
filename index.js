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
import winston from "winston";
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { spawn } from 'child_process';


// Load environment variables
dotenv.config();
const { Pool } = pkg;







// Winston logger configuration
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "backend.log" })
  ]
});


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


// Log the global npm directory
exec("npm root -g", (err, stdout, stderr) => {
  if (err) {
    console.error("Error fetching global npm path:", stderr);
  } else {
    console.log("Global npm path:", stdout.trim());
  }
});

// Log the path of eas-cli
exec("which eas", (err, stdout, stderr) => {
  if (err) {
    console.error("Error finding eas-cli:", stderr);
  } else {
    console.log("EAS CLI path:", stdout.trim());
  }
});








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




// FInding paths

// finding paths of eas and app
const easJsonPath = path.join(__dirname, 'eas.json');
const appJsonPath = path.join(__dirname, 'app.json');

// Check if these files exist and log their paths
if (fs.existsSync(easJsonPath)) {
  console.log(`Found eas.json at: ${easJsonPath}`);
} else {
  console.error('eas.json not found at expected path:', easJsonPath);
}

if (fs.existsSync(appJsonPath)) {
  console.log(`Found app.json at: ${appJsonPath}`);
} else {
  console.error('app.json not found at expected path:', appJsonPath);
}







// Define 'uploadsDir' at the top of the file
const uploadsDir = path.join(__dirname, 'uploads');

// Ensure the 'uploads' folder exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log(`Created 'uploads' directory at ${uploadsDir}`);
}

// Set appropriate permissions for the 'uploads' folder
fs.chmodSync(uploadsDir, 0o755);

// Serve static files with cache control
app.use('/uploads', express.static(uploadsDir, {
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  },
}));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}${path.extname(file.originalname)}`),
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    allowedMimeTypes.includes(file.mimetype) ? cb(null, true) : cb(new Error('Invalid file type'));
  },
});


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


// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


// Error Handling Middleware
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`);
  res.status(500).send("Internal server error");
});


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



// Root Route
app.get('/', (req, res) => {
    res.send('Backend is running!');
});





app.post('/test-build', (req, res) => {
  exec('eas build --platform android --profile production --non-interactive', { cwd: __dirname }, (err, stdout, stderr) => {
    console.log('STDOUT:', stdout);
    console.error('STDERR:', stderr);
    if (err) return res.status(500).send(stderr);
    res.send(stdout);
  });
});









// APK generation endpoint
app.post("/apk-gen", (req, res) => {
  const { name, website } = req.body;

  if (!name || !website) {
    return res.status(400).json({ success: false, message: "Name and website are required." });
  }

  try {
    // Path to `app.json`
    const appJsonPath = path.join(__dirname, "app.json");

    // Read and update `app.json`
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf-8"));
    appJson.expo.name = name;
    appJson.expo.extra = { website }; // Add extra field for website
    fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2));

    console.log("app.json updated successfully!");

    // Trigger EAS build using the explicit EAS CLI path
    const easCommand = "/opt/render/project/nodes/node-18.20.5/bin/eas";
    exec(
      `${easCommand} build --platform android --profile production`,
      { cwd: __dirname },
      (err, stdout, stderr) => {
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
          "UPDATE apps SET app_url = $1 WHERE website = $2 RETURNING *",
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
      }
    );
  } catch (error) {
    console.error("Error in generate-app:", error);
    res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
  }
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
            'growing_business',
            'established_business',
            'just_getting_started',
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

// API Endpoint for Uploading Icon and Splash Icon
app.post(
  '/api/upload-icons',
  verifyToken,
  upload.fields([{ name: 'icon' }, { name: 'splash_icon' }]),
  async (req, res) => {
    try {
      const { user_id } = req.body;
      const iconFile = req.files?.icon?.[0];
      const splashIconFile = req.files?.splash_icon?.[0];

      if (!iconFile || !splashIconFile) {
        return res.status(400).json({
          message: 'Both icon and splash icon files are required.',
        });
      }

      // Get the file paths with the correct extensions
      const iconPath = iconFile.filename;
      const splashIconPath = splashIconFile.filename;

      // Update the database with the file paths
      const result = await pool.query(
        `
        UPDATE apps
        SET icon = $1, splash_icon = $2
        WHERE id = $3 RETURNING *;
        `,
        [iconPath, splashIconPath, req.userId]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ message: 'User not found.' });
      }

      res.status(200).json({
        message: 'Files uploaded and database updated successfully.',
        user: result.rows[0],
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'An error occurred.', error: error.message });
    }
  }
);


// API to Get User's Icon and Splash Icon
app.get('/api/get-icons', verifyToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT icon, splash_icon FROM apps WHERE id = $1', [req.userId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const user = result.rows[0];
    const baseUrl = `${req.protocol}://${req.get('host')}/uploads`;
    
    const iconPath = path.join(uploadsDir, user.icon || '');
    const splashIconPath = path.join(uploadsDir, user.splash_icon || '');
    
    const iconUrl = fs.existsSync(iconPath) ? `${baseUrl}/${user.icon}` : null;
    const splashIconUrl = fs.existsSync(splashIconPath) ? `${baseUrl}/${user.splash_icon}` : null;

    res.status(200).json({
      message: 'User icons retrieved successfully!',
      icons: { icon: iconUrl, splash_icon: splashIconUrl },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'An error occurred.', error: error.message });
  }
});




// Route: Update Features, App Design, and Customization
app.post('/api/update-preferences', verifyToken, async (req, res) => {
    try {
        const { features } = req.body;

        // Validate features (must be an array)
        if (!Array.isArray(features)) {
            return res.status(400).json({
                message: 'Features must be an array.',
            });
        }

        // Update the database
        const result = await pool.query(
            `
            UPDATE apps 
            SET features = $1
            WHERE id = $2 
            RETURNING *;
            `,
            [
                features.join(','), // Store as a comma-separated string
                req.userId,
            ]
        );

        // Check if a row was updated
        if (result.rowCount === 0) {
            return res.status(400).json({
                message: 'No updates were made. User may not exist.',
            });
        }

        res.status(200).json({
            message: 'Preferences updated successfully!',
            user: result.rows[0], // Returning the updated user data
        });
    } catch (error) {
        console.error('Error updating preferences:', error);
        res.status(500).json({
            message: 'Failed to update preferences.',
            error: error.message,
        });
    }
});



// Route: Login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  // Validate input
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    // Check if the user exists in the database
    const result = await pool.query('SELECT * FROM apps WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // Verify the password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // Generate JWT token
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    // Respond with the token and user details
    res.status(200).json({
      message: 'Login successful!',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        website: user.website,
      },
      token,
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ message: 'Login failed.', error: error.message });
  }
});

// Route: Retrieve User Data
app.get('/api/user-data', verifyToken, async (req, res) => {
    try {
        // Use the userId from the verified token
        const userId = req.userId;

        // Query the database for the user
        const result = await pool.query('SELECT * FROM apps WHERE id = $1', [userId]);

        // Handle case where no user is found
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Send back the user's data
        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Error retrieving user data:', error);
        res.status(500).json({ message: 'Failed to retrieve user data', error: error.message });
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




// Update Account Details
app.post('/api/update-account-details', verifyToken, async (req, res) => {
    const { name, app_name, country } = req.body;

    // Check if at least one field is provided
    if (
        (name === undefined || name === null || name === '') &&
        (app_name === undefined || app_name === null || app_name === '') &&
        (country === undefined || country === null || country === '')
    ) {
        return res.status(400).json({ message: 'At least one field must be provided for submission.' });
    }

    try {
        // Construct the dynamic query
        const fields = [];
        const values = [];
        let fieldIndex = 1;

        if (name) {
            fields.push(`name = $${fieldIndex++}`);
            values.push(name);
        }
        if (app_name) {
            fields.push(`app_name = $${fieldIndex++}`);
            values.push(app_name);
        }
        if (country) {
            fields.push(`country = $${fieldIndex++}`);
            values.push(country);
        }

        // Append userId (assuming your verifyToken middleware provides req.userId)
        values.push(req.userId);

        // Construct the query to update the `apps` table
        const query = `
            UPDATE apps
            SET ${fields.join(', ')}
            WHERE id = $${fieldIndex}
            RETURNING *;
        `;

        // Execute the query
        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'App not found or no changes made.' });
        }

        // Respond with the updated app details
        res.status(200).json({
            message: 'App details submitted successfully.',
            app: result.rows[0],
        });
    } catch (error) {
        console.error('Error submitting app details:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
});








// Generate App
// Route: Generate App (Trigger EAS Build)
app.post('/generate-app', async (req, res) => {
  const { name, website } = req.body;

  if (!name || !website) {
    return res.status(400).json({ success: false, message: "Name and website are required." });
  }

  try {
    // Path to `app.json` (using same path as in your referenced code)
    const appJsonPath = path.join(__dirname, 'app.json');  // Same as the referenced code

    // Ensure `app.json` exists
    if (!fs.existsSync(appJsonPath)) {
      return res.status(500).json({ success: false, message: `app.json not found at ${appJsonPath}` });
    }

    // Read and update `app.json`
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf-8'));
    appJson.expo.name = name;
    appJson.expo.extra = { website }; // Add extra field for website

    // Write the updated `app.json`
    fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2));

    console.log("app.json updated successfully!");

    // Trigger EAS build (Ensure `eas-cli` is installed globally)
    exec('eas build --platform android --profile production', { cwd: __dirname }, (err, stdout, stderr) => {
      if (err) {
        console.error("Error during EAS build:", stderr);
        return res.status(500).json({ success: false, message: "EAS build failed.", error: stderr });
      }

      // Parse EAS build response for the build link
      const buildLinkMatch = stdout.match(/https:\/\/expo\.dev\/accounts\/.*\/builds\/[a-zA-Z0-9\-]+/);
      if (!buildLinkMatch) {
        return res.status(500).json({ success: false, message: "Failed to retrieve build link." });
      }

      const buildLink = buildLinkMatch[0];
      console.log("Build link:", buildLink);

      // Store app_url in the database (example, you can adjust as needed)
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
