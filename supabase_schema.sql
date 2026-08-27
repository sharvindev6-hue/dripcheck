-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Items table (wardrobe pieces)
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('top', 'bottom', 'shoes', 'outerwear')),
  primary_color TEXT NOT NULL,
  secondary_color TEXT,
  formality TEXT NOT NULL CHECK (formality IN ('casual', 'smart_casual', 'formal')),
  warmth TEXT NOT NULL CHECK (warmth IN ('hot', 'mild', 'cold')),
  price DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Outfits table (daily outfit logs)
CREATE TABLE outfits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  occasion TEXT NOT NULL,
  weather_temp INTEGER,
  item_ids UUID[] NOT NULL,
  explanation_text TEXT,
  is_favorite BOOLEAN DEFAULT FALSE,
  was_worn BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE outfits ENABLE ROW LEVEL SECURITY;

-- Users: only see own data
CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (auth.uid() = id);

-- Items: CRUD for own items
CREATE POLICY "Items: users can view own" ON items
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Items: users can insert own" ON items
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Items: users can update own" ON items
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Items: users can delete own" ON items
  FOR DELETE USING (auth.uid() = user_id);

-- Outfits: CRUD for own outfits
CREATE POLICY "Outfits: users can view own" ON outfits
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Outfits: users can insert own" ON outfits
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Outfits: users can update own" ON outfits
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Outfits: users can delete own" ON outfits
  FOR DELETE USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_items_user_id ON items(user_id);
CREATE INDEX idx_items_category ON items(category);
CREATE INDEX idx_outfits_user_date ON outfits(user_id, date DESC);

-- Trigger to create user record on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
