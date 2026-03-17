# Vercel Deployment Instructions

This document explains how to deploy your lightweight Vercel serverless backend for the **Privacy Policy Analyzer** extension.

## 1. Prerequisites
- Create a [Vercel account](https://vercel.com/) if you don't have one.
- Install the [Vercel CLI](https://vercel.com/docs/cli) globally on your machine:
  ```bash
  npm i -g vercel
  ```

## 2. Project Setup
Vercel requires a package.json to manage dependencies or root configuration. If you don't have one, initialize it in the root folder (`privacy-policy-analyzer`):
```bash
npm init -y
```

Make sure that your application structure looks like this:
```
privacy-policy-analyzer/
├── api/
│   └── analyze.js       <-- (Serverless Function)
├── config/
│   └── apiKey.js        <-- (Stores NVIDIA API Key)
├── extension files...   <-- (manifest.json, popup.js, etc.)
```

## 3. Local Testing
To test your serverless API locally:
1. Open up a terminal in your project directory (`privacy-policy-analyzer`).
2. Run the Vercel dev server:
   ```bash
   vercel dev
   ```
3. Update `config/apiKey.js` with your active NVIDIA NIM API key before starting.
4. Your API will be available at `http://localhost:3000/api/analyze`.

## 4. Deploying to Vercel Production
1. In your terminal, authenticate with Vercel:
   ```bash
   vercel login
   ```
2. Deploy the project:
   ```bash
   vercel
   ```
3. Follow the CLI prompts to set up the project. Once completed, Vercel will provide a production URL (e.g., `https://your-project-name.vercel.app`).

## 5. Setting up Environment Variables (Important for Security!)
Instead of hardcoding your NVIDIA API Key in `/config/apiKey.js`, you should add it to your Vercel Project Environment Variables as it's a security risk.

1. Go to your Vercel Dashboard -> Projects -> Your Project Name -> Settings -> Environment Variables.
2. Add a new variable:
   - **Key**: `NVIDIA_API_KEY`
   - **Value**: `your_actual_api_key_here`
3. Update your `/config/apiKey.js` to fallback to `process.env`:
   ```javascript
   export const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || "PASTE_API_KEY_HERE";
   ```
4. Re-deploy your project using `vercel --prod` to apply the environment variable.

## 6. Update the Extension
Once deployed, go into `popup.js` (or wherever you integrated the backend) and change the `API_URL` variable to your new Vercel App API URL:
   ```javascript
   const API_URL = 'https://YOUR_VERCEL_APP_URL.vercel.app/api/analyze';
   ```

You are now ready to use the Llama 3 powered backend safely!
