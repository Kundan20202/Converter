import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to handle /generate-app
export const generateApp = async (req, res) => {
  const { name, email, website, app_name } = req.body;

  // Validate input
  if (!name || !email || !website || !app_name) {
    return res.status(400).json({
      success: false,
      message: 'All fields (name, email, website, app_name) are required.',
    });
  }

  try {
    // Step 1: Update app.json in the root directory
    const appJsonPath = path.join(__dirname, '../app.json');
    const appJsonContent = {
      expo: {
        name: app_name,
        slug: app_name.toLowerCase().replace(/\s+/g, '-'),
        version: '1.0.0',
        sdkVersion: '51.0.0',
        orientation: 'portrait',
        icon: './assets/icon.png',
        splash: {
          image: './assets/splash.png',
          resizeMode: 'contain',
          backgroundColor: '#ffffff',
        },
        platforms: ['ios', 'android'],
        android: {
          package: `com.appforge.${app_name.toLowerCase().replace(/\s+/g, '')}`,
          adaptiveIcon: {
            foregroundImage: './assets/icon.png',
            backgroundColor: '#ffffff',
          },
        },
        ios: {
          bundleIdentifier: `com.appforge.${app_name.toLowerCase().replace(/\s+/g, '')}`,
          buildNumber: '1.0.0',
        },
        extra: {
          website,
          email,
        },
      },
    };

    // Write app.json to the root folder
    fs.writeFileSync(appJsonPath, JSON.stringify(appJsonContent, null, 2));
    console.log('app.json updated successfully.');

    // Step 2: Run the EAS Build command
    const buildCommand = 'eas build --profile production --platform all';
    console.log('Executing build command:', buildCommand);

    exec(buildCommand, { cwd: path.join(__dirname, '..') }, (error, stdout, stderr) => {
      if (error) {
        console.error('Build failed:', stderr);
        return res.status(500).json({
          success: false,
          message: 'EAS build failed.',
          error: stderr || error.message,
        });
      }

      console.log('Build succeeded:', stdout);

      // Extract APK and AAB file URLs from the output
      const aabUrlMatch = stdout.match(/https:\/\/.*\.aab/);
      const apkUrlMatch = stdout.match(/https:\/\/.*\.apk/);

      if (!aabUrlMatch && !apkUrlMatch) {
        return res.status(500).json({
          success: false,
          message: 'Build completed, but no output file URLs were found.',
        });
      }

      return res.status(200).json({
        success: true,
        message: 'App built successfully.',
        appUrls: {
          aab: aabUrlMatch ? aabUrlMatch[0] : null,
          apk: apkUrlMatch ? apkUrlMatch[0] : null,
        },
      });
    });
  } catch (err) {
    console.error('Error generating app:', err);
    res.status(500).json({
      success: false,
      message: 'An error occurred while generating the app.',
      error: err.message,
    });
  }
};
