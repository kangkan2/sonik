import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";
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
    });

    res.redirect(url);
  });

  // Google OAuth Callback
  app.get("/api/auth/google/callback", async (req, res) => {
    const { code } = req.query;

    try {
      const client = getOAuthClient(req);
      const { tokens } = await client.getToken(code as string);
      // In a real app, you'd verify the token and get user info
      // Then generate a session or just pass the token back to the app
      
      // Redirect back to the app using deep link
      // The 'sonik://' scheme should be configured in AndroidManifest.xml / Info.plist
      const deepLink = `sonik://auth-success?access_token=${tokens.access_token}&id_token=${tokens.id_token}`;
      
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
              // Try to auto-redirect
              window.location.href = "${deepLink}";
              // Close window after a delay if auto-redirect worked
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
