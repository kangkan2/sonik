import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to get dynamic OAuth client
const getOAuthClient = (req: express.Request) => {
  const host = req.get("host");
  // Use https if not on localhost
  const protocol = host?.includes("localhost") ? "http" : "https";
  const redirectUri = `${protocol}://${host}/api/auth/google/callback`;
  
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );
};

async function startServer() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.warn("WARNING: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is not set. Google Sign-In will not work.");
  }
  const app = express();
  const PORT = 3000;

  // API routes go here
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Google OAuth Start
  app.get("/api/auth/google", (req, res) => {
    const scopes = [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
    ];

    const client = getOAuthClient(req);
    const url = client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'select_account'
    });

    res.redirect(url);
  });

  // Google OAuth Callback
  app.get("/api/auth/google/callback", async (req, res) => {
    const { code } = req.query;

    try {
      const client = getOAuthClient(req);
      const { tokens } = await client.getToken(code as string);
      
      // Redirect back to the app using deep link
      const deepLink = `sonik://auth-success?provider=google&access_token=${tokens.access_token}&id_token=${tokens.id_token}`;
      
      res.send(`
        <html>
          <head>
            <title>Authentication Successful</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #141414; color: white; text-align: center; }
              .btn { background: #E50914; color: white; padding: 12px 24px; border-radius: 4px; text-decoration: none; font-weight: bold; margin-top: 20px; }
            </style>
          </head>
          <body>
            <h2>Authentication Successful!</h2>
            <p>You can now close this window and return to the app.</p>
            <a href="${deepLink}" class="btn">Return to App</a>
            <script>
              window.location.href = "${deepLink}";
              setTimeout(() => { window.close(); }, 3000);
            </script>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Error during Google Auth:", error);
      res.status(500).send("Authentication failed");
    }
  });

  // GitHub OAuth Start
  app.get("/api/auth/github", (req, res) => {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const host = req.get("host");
    const protocol = host?.includes("localhost") ? "http" : "https";
    const redirectUri = `${protocol}://${host}/api/auth/github/callback`;
    const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=user:email`;
    res.redirect(url);
  });

  // GitHub OAuth Callback
  app.get("/api/auth/github/callback", async (req, res) => {
    const { code } = req.query;

    try {
      const host = req.get("host");
      const protocol = host?.includes("localhost") ? "http" : "https";
      const redirectUri = `${protocol}://${host}/api/auth/github/callback`;

      const response = await axios.post('https://github.com/login/oauth/access_token', {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code: code,
        redirect_uri: redirectUri,
      }, {
        headers: { Accept: 'application/json' }
      });

      const accessToken = response.data.access_token;
      
      // Redirect back to the app using deep link
      const deepLink = `sonik://auth-success?provider=github&access_token=${accessToken}`;
      
      res.send(`
        <html>
          <head>
            <title>Authentication Successful</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #141414; color: white; text-align: center; }
              .btn { background: #E50914; color: white; padding: 12px 24px; border-radius: 4px; text-decoration: none; font-weight: bold; margin-top: 20px; }
            </style>
          </head>
          <body>
            <h2>Authentication Successful!</h2>
            <p>You can now close this window and return to the app.</p>
            <a href="${deepLink}" class="btn">Return to App</a>
            <script>
              window.location.href = "${deepLink}";
              setTimeout(() => { window.close(); }, 3000);
            </script>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Error during GitHub Auth:", error);
      res.status(500).send("Authentication failed");
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
