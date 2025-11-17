# Supabase Setup Guide

This guide will help you set up Supabase for user authentication and cloud storage in the Movie Ranking App.

## Step 1: Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign up or sign in
3. Click "New Project"
4. Fill in:
   - **Project Name**: `movie-ranking-app` (or your choice)
   - **Database Password**: Create a strong password (save it!)
   - **Region**: Choose closest to your users
5. Click "Create new project"
6. Wait 2-3 minutes for project to initialize

## Step 2: Get Your API Keys

1. In your Supabase project dashboard, go to **Settings** → **API**
2. Copy:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon public** key (under "Project API keys")

## Step 3: Configure the App

1. Open `supabaseService.js`
2. Replace the placeholder values:

```javascript
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key-here';
```

## Step 4: Create Database Tables

In your Supabase dashboard, go to **SQL Editor** and run these SQL commands:

### Table 1: Rankings

```sql
CREATE TABLE rankings (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  list_name TEXT NOT NULL,
  list_type TEXT NOT NULL,
  ranked_movies JSONB NOT NULL,
  unseen_movies JSONB DEFAULT '[]'::jsonb,
  total_comparisons INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX idx_rankings_user_id ON rankings(user_id);
CREATE INDEX idx_rankings_created_at ON rankings(created_at DESC);
```

### Table 2: Custom Lists

```sql
CREATE TABLE custom_lists (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  items JSONB NOT NULL,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_custom_lists_user_id ON custom_lists(user_id);
CREATE INDEX idx_custom_lists_public ON custom_lists(is_public) WHERE is_public = TRUE;
CREATE INDEX idx_custom_lists_created_at ON custom_lists(created_at DESC);
```

### Table 3: User Profiles (Optional - for display names)

```sql
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read all profiles
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);
```

## Step 5: Set Up Row Level Security (RLS)

Run these SQL commands to enable RLS and create policies:

### Rankings RLS

```sql
ALTER TABLE rankings ENABLE ROW LEVEL SECURITY;

-- Users can only see their own rankings
CREATE POLICY "Users can view own rankings"
  ON rankings FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own rankings
CREATE POLICY "Users can insert own rankings"
  ON rankings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own rankings
CREATE POLICY "Users can delete own rankings"
  ON rankings FOR DELETE
  USING (auth.uid() = user_id);
```

### Custom Lists RLS

```sql
ALTER TABLE custom_lists ENABLE ROW LEVEL SECURITY;

-- Users can view their own lists and public lists
CREATE POLICY "Users can view own and public lists"
  ON custom_lists FOR SELECT
  USING (auth.uid() = user_id OR is_public = TRUE);

-- Users can insert their own lists
CREATE POLICY "Users can insert own lists"
  ON custom_lists FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own lists
CREATE POLICY "Users can update own lists"
  ON custom_lists FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own lists
CREATE POLICY "Users can delete own lists"
  ON custom_lists FOR DELETE
  USING (auth.uid() = user_id);
```

## Step 6: Enable Email Authentication

1. Go to **Authentication** → **Providers** in Supabase dashboard
2. Make sure **Email** is enabled
3. Configure email templates (optional):
   - Go to **Authentication** → **Email Templates**
   - Customize welcome email, password reset, etc.

## Step 7: Test the Integration

1. Open your app
2. Click "Sign Up" in the header
3. Create a test account
4. Verify email (check your inbox)
5. Sign in
6. Create a custom list and save it
7. Check Supabase dashboard → **Table Editor** → `custom_lists` to see your data

## Features Enabled

Once set up, users can:

✅ **Sign up / Sign in** with email and password  
✅ **Save rankings to cloud** (synced across devices)  
✅ **Save custom lists to cloud**  
✅ **Share lists as community templates**  
✅ **Browse and import community templates**  
✅ **Automatic sync** between localStorage and cloud  

## Troubleshooting

### "Supabase not configured" error
- Make sure you've updated `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `supabaseService.js`

### "Failed to save" errors
- Check that RLS policies are set up correctly
- Verify your anon key has the right permissions
- Check browser console for detailed error messages

### Data not syncing
- Make sure user is signed in
- Check network tab for API errors
- Verify tables exist in Supabase dashboard

### Community templates not showing
- Make sure some lists are marked as `is_public = TRUE`
- Check RLS policy allows reading public lists

## Security Notes

- The `anon` key is safe to use in client-side code (it's public)
- RLS policies ensure users can only access their own data
- Never expose your `service_role` key in client code
- All authentication is handled securely by Supabase

## Next Steps

- Add social login (Google, GitHub, etc.) in Supabase dashboard
- Set up email verification requirements
- Add rate limiting if needed
- Monitor usage in Supabase dashboard

