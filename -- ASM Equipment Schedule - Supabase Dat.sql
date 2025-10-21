-- ASM Equipment Schedule - Supabase Database Schema
-- This schema leverages Supabase's built-in auth.users table

-- Enable Row Level Security (RLS) for all tables
-- This ensures users can only access data based on their role

-- Equipment table
CREATE TABLE equipment (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(255) NOT NULL,
  equipment_id VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Locations table
CREATE TABLE locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_name VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- User profiles table (extends auth.users with role information)
CREATE TABLE user_profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  role VARCHAR(20) CHECK (role IN ('admin', 'editor', 'viewer')) NOT NULL DEFAULT 'viewer',
  full_name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Schedule entries table
CREATE TABLE schedule_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_id UUID REFERENCES equipment(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = Sunday, 6 = Saturday
  start_hour INTEGER CHECK (start_hour >= 0 AND start_hour <= 23),
  end_hour INTEGER CHECK (end_hour >= 0 AND end_hour <= 23),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_time_range CHECK (end_hour > start_hour)
);

-- Settings table for configurable options
CREATE TABLE settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default settings
INSERT INTO settings (setting_key, setting_value) VALUES
('start_hour', '6'),
('end_hour', '18');

-- Enable Row Level Security
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies

-- Equipment policies
CREATE POLICY "Everyone can view equipment" ON equipment FOR SELECT USING (true);
CREATE POLICY "Editors and admins can insert equipment" ON equipment FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role IN ('editor', 'admin')
    )
  );
CREATE POLICY "Editors and admins can update equipment" ON equipment FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role IN ('editor', 'admin')
    )
  );
CREATE POLICY "Admins can delete equipment" ON equipment FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Locations policies
CREATE POLICY "Everyone can view locations" ON locations FOR SELECT USING (true);
CREATE POLICY "Editors and admins can insert locations" ON locations FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role IN ('editor', 'admin')
    )
  );
CREATE POLICY "Editors and admins can update locations" ON locations FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role IN ('editor', 'admin')
    )
  );
CREATE POLICY "Admins can delete locations" ON locations FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- User profiles policies
CREATE POLICY "Users can view all profiles" ON user_profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE 
  USING (auth.uid() = id);
CREATE POLICY "Admins can update any profile" ON user_profiles FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
CREATE POLICY "Admins can insert profiles" ON user_profiles FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Schedule entries policies
CREATE POLICY "Everyone can view schedule entries" ON schedule_entries FOR SELECT USING (true);
CREATE POLICY "Editors and admins can insert schedule entries" ON schedule_entries FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role IN ('editor', 'admin')
    )
  );
CREATE POLICY "Editors and admins can update schedule entries" ON schedule_entries FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role IN ('editor', 'admin')
    )
  );
CREATE POLICY "Editors and admins can delete schedule entries" ON schedule_entries FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role IN ('editor', 'admin')
    )
  );

-- Settings policies
CREATE POLICY "Everyone can view settings" ON settings FOR SELECT USING (true);
CREATE POLICY "Admins can update settings" ON settings FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create indexes for better performance
CREATE INDEX idx_schedule_equipment ON schedule_entries(equipment_id);
CREATE INDEX idx_schedule_location ON schedule_entries(location_id);
CREATE INDEX idx_schedule_day ON schedule_entries(day_of_week);
CREATE INDEX idx_equipment_id ON equipment(equipment_id);
CREATE INDEX idx_user_profiles_role ON user_profiles(role);

-- Function to automatically create user profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'viewer'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile for new users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add update triggers to all tables
CREATE TRIGGER update_equipment_updated_at BEFORE UPDATE ON equipment
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON locations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_schedule_entries_updated_at BEFORE UPDATE ON schedule_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data for testing
INSERT INTO equipment (name, type, equipment_id, description) VALUES
('Excavator A1', 'Heavy Machinery', 'EXC-001', 'Large excavator for major construction projects'),
('Forklift B2', 'Material Handling', 'FLT-002', 'Electric forklift for warehouse operations'),
('Generator C3', 'Power Equipment', 'GEN-003', 'Diesel generator for remote locations'),
('Concrete Mixer D4', 'Construction Equipment', 'MIX-004', 'Portable concrete mixer for small jobs');

INSERT INTO locations (job_name, address) VALUES
('Downtown Construction Site', '123 Main St, Downtown, City, State 12345'),
('Warehouse District', '456 Industrial Blvd, Warehouse District, City, State 12346'),
('Residential Development', '789 Suburb Ave, Residential Area, City, State 12347'),
('Bridge Repair Project', '100 River Rd, Bridge District, City, State 12348');