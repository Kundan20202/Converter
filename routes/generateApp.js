import axios from 'axios';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { exec } from 'child_process';

// Load environment variables from .env file
dotenv.config();


// Dynamically resolve the path
const EXPO_PROJECT_PATH = path.resolve(__dirname, 'Expo');  // Adjust 'Expo' to your relative directory path

// Check if the Expo project directory exists
if (!fs.existsSync(EXPO_PROJECT_PATH)) {
  console.error('Expo project directory not found:', EXPO_PROJECT_PATH);
  return res.status(500).json({ success: false, message: 'Expo project directory not found.' });
} else {
  console.log('Expo project directory exists:', EXPO_PROJECT_PATH);
}
