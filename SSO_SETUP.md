# SSO (Social Sign-In) Setup Guide

This guide will help you enable Google and GitHub sign-in for your Movie Ranking App.

## Step 1: Enable OAuth Providers in Supabase

### Google OAuth Setup

1. Go to your Supabase dashboard: https://supabase.com/dashboard/project/jdyqevwzvczmcqrpogpw
2. Navigate to **Authentication** → **Providers**
3. Find **Google** in the list
4. Toggle it **ON**
5. You'll need to create a Google OAuth app:

#### Create Google OAuth App:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Go to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. Choose **Web application**
6. Add authorized redirect URIs:
   - `https://jdyqevwzvczmcqrpogpw.supabase.co/auth/v1/callback`
7. Copy the **Client ID** and **Client Secret**
8. Paste them into Supabase **Google** provider settings
9. Click **Save**

### GitHub OAuth Setup

1. In Supabase dashboard, go to **Authentication** → **Providers**
2. Find **GitHub** in the list
3. Toggle it **ON**
4. You'll need to create a GitHub OAuth app:

#### Create GitHub OAuth App:

1. Go to GitHub → **Settings** → **Developer settings** → **OAuth Apps**
2. Click **New OAuth App**
3. Fill in:
   - **Application name**: `Movie Ranking App` (or your choice)
   - **Homepage URL**: Your app URL (e.g., `http://localhost:8000` or your domain)
   - **Authorization callback URL**: `https://jdyqevwzvczmcqrpogpw.supabase.co/auth/v1/callback`
4. Click **Register application**
5. Copy the **Client ID**
6. Click **Generate a new client secret** and copy it
7. Paste both into Supabase **GitHub** provider settings
8. Click **Save**

## Step 2: Update Redirect URLs

1. In Supabase dashboard, go to **Authentication** → **URL Configuration**
2. Under **Redirect URLs**, make sure you have:
   - `http://localhost:8000/**` (for local development)
   - `http://localhost:3000/**` (if using port 3000)
   - Your production URL if deployed
3. Click **Save**

## Step 3: Test SSO Sign-In

1. Refresh your app
2. Click **Sign In** or **Sign Up**
3. You should see:
   - **Continue with Google** button
   - **Continue with GitHub** button
4. Click one of the SSO buttons
5. You'll be redirected to Google/GitHub for authentication
6. After approving, you'll be redirected back to your app
7. You should be signed in automatically!

## Available Providers

The app currently supports:
- ✅ **Google** - Most popular, easy setup
- ✅ **GitHub** - Great for developers
- 🔄 **Email/Password** - Already working

You can easily add more providers in Supabase:
- Facebook
- Twitter/X
- Discord
- Apple
- Azure
- And more...

## Adding More Providers

1. Go to **Authentication** → **Providers** in Supabase
2. Toggle on the provider you want
3. Follow the provider's setup instructions
4. Add the provider button to `index.html` (copy the Google/GitHub button pattern)
5. Add the provider name to `handleSSOSignIn()` function

Example for Facebook:
```javascript
<button onclick="handleSSOSignIn('facebook')" class="...">
    Continue with Facebook
</button>
```

## Troubleshooting

### "Redirect URI mismatch" error
- Make sure the callback URL in your OAuth app matches exactly: `https://jdyqevwzvczmcqrpogpw.supabase.co/auth/v1/callback`
- Check Supabase redirect URLs include your app URL

### OAuth button doesn't redirect
- Check browser console for errors
- Verify the provider is enabled in Supabase
- Make sure Client ID and Secret are correct

### User not signed in after OAuth
- Check that redirect URLs are configured correctly
- Verify the OAuth app callback URL matches Supabase
- Check browser console for authentication errors

## Security Notes

- OAuth credentials (Client ID/Secret) are stored securely in Supabase
- Users can choose which provider to use
- All authentication is handled by Supabase securely
- No passwords stored for OAuth users

