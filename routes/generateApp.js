import axios from 'axios';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { exec } from 'child_process';

// Load environment variables from .env file
dotenv.config();

// Your GitHub token
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = 'Kundan20202';  // Replace with your GitHub username or organization
const REPO_NAME = 'Expo';  // Replace with your repository name
const APP_JSON_PATH = 'app.json';  // Path to the app.json in the repository

// Path to your Expo project folder (make sure this path is correct)
// const EXPO_PROJECT_PATH = path.resolve('/workspaces/Expo'); // Dynamically resolved path

// Check if the Expo project directory exists
if (!fs.existsSync(EXPO_PROJECT_PATH)) {
  console.error('Expo project directory not found:', EXPO_PROJECT_PATH);
  process.exit(1);  // Exit if directory is not found
}

const updateAppJson = async (updatedAppJson) => {
  try {
    // Step 1: Fetch the current app.json to get the SHA for updating
    const response = await axios.get(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${APP_JSON_PATH}`, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
      },
    });

    const sha = response.data.sha;  // Retrieve the SHA of the current app.json

    // Step 2: Update the app.json file with the new content
    const updateResponse = await axios.put(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${APP_JSON_PATH}`,
      {
        message: 'Update app.json for new app generation',  // Commit message
        content: Buffer.from(JSON.stringify(updatedAppJson, null, 2)).toString('base64'),  // Encode the content to base64
        sha: sha,  // Provide the SHA to ensure we update the correct file version
      },
      {
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
        },
      }
    );

    console.log('File updated successfully:', updateResponse.data.content);
  } catch (error) {
    console.error('Error updating app.json:', error.response ? error.response.data : error.message);
  }
};

// Function to handle /generate-app endpoint
export const generateApp = async (req, res) => {
  const { name, email, website, app_name } = req.body;

  if (!name || !email || !website || !app_name) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  try {
    // Step 3: Prepare the updated app.json structure
    const appJson = {
      expo: {
        name: app_name,
        slug: app_name.toLowerCase().replace(/\s+/g, '-'),
        version: "1.0.0",
        orientation: "portrait",
        icon: "./assets/icon.png",
        splash: {
          image: "./assets/splash.png",
          resizeMode: "contain",
          backgroundColor: "#ffffff"
        },
        ios: {
          supportsTablet: true
        },
        android: {
          adaptiveIcon: {
            foregroundImage: "./assets/adaptive-icon.png",
            backgroundColor: "#ffffff"
          }
        },
        plugins: [
          [
            "expo-build-properties",
            {
              android: {
                gradleVersion: "8.2",
                androidGradlePluginVersion: "8.2.0"
              }
            }
          ]
        ]
      }
    };

    // Step 4: Update the app.json in the GitHub repository
    await updateAppJson(appJson);

    // Step 5: Run the build command for Expo (after the app.json is updated)
    const buildCommand = `cd ${EXPO_PROJECT_PATH} && eas build --profile production --platform android`;

    // Check if the Expo project directory exists
    if (!fs.existsSync(EXPO_PROJECT_PATH)) {
      return res.status(500).json({ success: false, message: 'Expo project directory not found on the server.' });
    }

    exec(buildCommand, (error, stdout, stderr) => {
      if (error) {
        console.error("Build command failed:", stderr);
        return res.status(500).json({ success: false, message: "EAS build failed.", error: stderr });
      }
      console.log("Build output:", stdout);

      // Extract APK and AAB file URLs from the output
      const aabUrlMatch = stdout.match(/https:\/\/.*\.aab/);
      const apkUrlMatch = stdout.match(/https:\/\/.*\.apk/);

      if (!aabUrlMatch && !apkUrlMatch) {
        return res.status(500).json({
          success: false,
          message: 'Build completed, but no output file URLs were found.',
        });
      }

      // Return the generated app download URLs
      return res.status(200).json({
        success: true,
        message: 'App built successfully.',
        appUrls: {
          aab: aabUrlMatch ? aabUrlMatch[0] : null,
          apk: apkUrlMatch ? apkUrlMatch[0] : null,
        },
      });
    });

  } catch (error) {
    console.error("Error in generateApp:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};
