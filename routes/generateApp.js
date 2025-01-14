import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to handle /generate-app
const expoProjectPath = '/workspaces/Expo/app.json'; // Update this path to your Codespaces Expo project
const appJsonPath = path.join(expoProjectPath, 'app.json');

export const generateApp = async (req, res) => {
  const { name, email, website, app_name } = req.body;

  if (!name || !email || !website || !app_name) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  try {
    // Update app.json dynamically
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

    fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2));
    console.log("Updated app.json for:", app_name);

    // Run the build command
    const buildCommand = `cd ${expoProjectPath} && eas build --profile production --platform android`;
    exec(buildCommand, (error, stdout, stderr) => {
      if (error) {
        console.error("Build command failed:", stderr);
        return res.status(500).json({ success: false, message: "EAS build failed.", error: stderr });
      }
      console.log("Build output:", stdout);
      res.status(200).json({ success: true, message: "Build initiated successfully", output: stdout });
    });
  } catch (error) {
    console.error("Error in generateApp:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

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
