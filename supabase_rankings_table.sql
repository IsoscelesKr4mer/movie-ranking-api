-- Create rankings table for storing user movie rankings
-- Run this SQL in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS rankings (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    list_name TEXT NOT NULL,
    list_type TEXT, -- 'category', 'year', 'custom'
    ranked_movies JSONB NOT NULL DEFAULT '[]'::jsonb,
    unseen_movies JSONB DEFAULT '[]'::jsonb,
    total_comparisons INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_rankings_user_id ON rankings(user_id);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_rankings_created_at ON rankings(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE rankings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own rankings
CREATE POLICY "Users can view their own rankings"
    ON rankings FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own rankings
CREATE POLICY "Users can insert their own rankings"
    ON rankings FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own rankings
CREATE POLICY "Users can delete their own rankings"
    ON rankings FOR DELETE
    USING (auth.uid() = user_id);

-- Optional: Policy for updating (if you want to allow updates later)
CREATE POLICY "Users can update their own rankings"
    ON rankings FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

