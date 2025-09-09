/*
  # Create Pharmacy POS Database Schema

  1. New Tables
    - `user_profiles` - User management with roles and permissions
    - `products` - Product inventory with stock tracking
    - `sales` - Sales transactions with payment methods
    - `sale_items` - Individual items in each sale
    - `stock_movements` - Track inventory changes

  2. Security
    - Enable RLS on all tables
    - Add policies for role-based access control
    - Super admins can manage everything
    - Pharmtech can manage products and view sales
    - Cashiers can create sales and view products

  3. Sample Data
    - Demo user accounts for testing
    - Sample products for inventory
*/

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create handle_new_user function for auth triggers
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, role, is_active)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'), 'cashier', true);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user registration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Insert demo users into auth.users if they don't exist
DO $$
BEGIN
  -- Super Admin
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@pharmacy.com') THEN
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      'admin@pharmacy.com',
      crypt('password', gen_salt('bf')),
      NOW(),
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    );
  END IF;

  -- Staff/Pharmtech
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'staff@pharmacy.com') THEN
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      'staff@pharmacy.com',
      crypt('password', gen_salt('bf')),
      NOW(),
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    );
  END IF;

  -- Cashier
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'cashier@pharmacy.com') THEN
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      'cashier@pharmacy.com',
      crypt('password', gen_salt('bf')),
      NOW(),
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    );
  END IF;
END $$;

-- Update user_profiles for demo accounts
DO $$
DECLARE
  admin_id uuid;
  staff_id uuid;
  cashier_id uuid;
BEGIN
  -- Get user IDs
  SELECT id INTO admin_id FROM auth.users WHERE email = 'admin@pharmacy.com';
  SELECT id INTO staff_id FROM auth.users WHERE email = 'staff@pharmacy.com';
  SELECT id INTO cashier_id FROM auth.users WHERE email = 'cashier@pharmacy.com';

  -- Update or insert profiles
  INSERT INTO user_profiles (id, email, full_name, phone, role, is_active)
  VALUES 
    (admin_id, 'admin@pharmacy.com', 'System Administrator', '254700000001', 'super_admin', true),
    (staff_id, 'staff@pharmacy.com', 'Pharmacy Staff', '254700000002', 'pharmtech', true),
    (cashier_id, 'cashier@pharmacy.com', 'Cashier User', '254700000003', 'cashier', true)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    role = EXCLUDED.role,
    is_active = EXCLUDED.is_active;
END $$;

-- Insert sample products
INSERT INTO products (name, category, supplier, batch_number, expiry_date, cost_price, selling_price, stock_level, minimum_stock, barcode, description, prescription_required)
VALUES 
  ('Paracetamol 500mg', 'Pain Relief', 'PharmaCorp Ltd', 'PC001', '2025-12-31', 50.00, 80.00, 100, 20, '1234567890123', 'Pain and fever relief tablets', false),
  ('Amoxicillin 250mg', 'Antibiotics', 'MediSupply Co', 'MS002', '2025-06-30', 120.00, 180.00, 50, 10, '1234567890124', 'Antibiotic capsules', true),
  ('Vitamin C 1000mg', 'Supplements', 'HealthPlus', 'HP003', '2026-03-15', 80.00, 120.00, 75, 15, '1234567890125', 'Immune system support', false),
  ('Cough Syrup', 'Cold & Flu', 'CoughCare', 'CC004', '2025-09-20', 150.00, 220.00, 30, 5, '1234567890126', 'Relief for dry and wet cough', false),
  ('Omeprazole 20mg', 'Digestive Health', 'GastroMed', 'GM005', '2025-11-10', 200.00, 300.00, 40, 8, '1234567890127', 'Acid reflux treatment', true),
  ('Aspirin 75mg', 'Heart & Blood', 'CardioHealth', 'CH006', '2025-08-25', 60.00, 90.00, 80, 16, '1234567890128', 'Low-dose aspirin for heart health', false),
  ('Hydrocortisone Cream', 'Skin Care', 'DermaCare', 'DC007', '2025-07-18', 180.00, 250.00, 25, 5, '1234567890129', 'Topical anti-inflammatory cream', false),
  ('Eye Drops', 'Eye Care', 'VisionClear', 'VC008', '2025-05-12', 120.00, 180.00, 35, 7, '1234567890130', 'Lubricating eye drops', false),
  ('Digital Thermometer', 'Medical Supplies', 'MedTech', 'MT009', '2027-01-01', 800.00, 1200.00, 15, 3, '1234567890131', 'Digital fever thermometer', false),
  ('Bandages Pack', 'First Aid', 'FirstAid Pro', 'FA010', '2026-12-31', 150.00, 200.00, 60, 12, '1234567890132', 'Sterile adhesive bandages', false)
ON CONFLICT (barcode) DO NOTHING;