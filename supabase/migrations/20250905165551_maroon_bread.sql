/*
  # Pharmacy POS Database Schema

  1. New Tables
    - `profiles` - User profiles extending auth.users
      - `id` (uuid, references auth.users)
      - `name` (text)
      - `phone` (text)
      - `role` (enum: super_admin, pharmtech, cashier)
      - `is_active` (boolean)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `products` - Product/medicine inventory
      - `id` (uuid, primary key)
      - `name` (text)
      - `category` (text)
      - `supplier` (text)
      - `batch_number` (text)
      - `expiry_date` (date)
      - `cost_price` (numeric)
      - `selling_price` (numeric)
      - `stock_level` (integer)
      - `min_stock_level` (integer)
      - `barcode` (text)
      - `requires_prescription` (boolean)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `sales` - Sales transactions
      - `id` (uuid, primary key)
      - `receipt_number` (text, unique)
      - `subtotal` (numeric)
      - `tax` (numeric)
      - `total` (numeric)
      - `payment_method` (enum: cash, mpesa, card, insurance)
      - `mpesa_transaction_id` (text, nullable)
      - `staff_id` (uuid, references profiles)
      - `created_at` (timestamp)

    - `sale_items` - Individual items in each sale
      - `id` (uuid, primary key)
      - `sale_id` (uuid, references sales)
      - `product_id` (uuid, references products)
      - `product_name` (text)
      - `quantity` (integer)
      - `unit_price` (numeric)
      - `total` (numeric)

  2. Security
    - Enable RLS on all tables
    - Add policies for role-based access
    - Profiles accessible by users based on role
    - Products manageable by super_admin and pharmtech
    - Sales accessible by all authenticated users
    - Sale items follow sales permissions
*/

-- Create custom types
CREATE TYPE user_role AS ENUM ('super_admin', 'pharmtech', 'cashier');
CREATE TYPE payment_method AS ENUM ('cash', 'mpesa', 'card', 'insurance');

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL,
  role user_role NOT NULL DEFAULT 'cashier',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  supplier text NOT NULL,
  batch_number text NOT NULL,
  expiry_date date NOT NULL,
  cost_price numeric(10,2) NOT NULL DEFAULT 0,
  selling_price numeric(10,2) NOT NULL DEFAULT 0,
  stock_level integer NOT NULL DEFAULT 0,
  min_stock_level integer NOT NULL DEFAULT 0,
  barcode text,
  requires_prescription boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Sales table
CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number text UNIQUE NOT NULL,
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  tax numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL DEFAULT 0,
  payment_method payment_method NOT NULL,
  mpesa_transaction_id text,
  staff_id uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Sale items table
CREATE TABLE IF NOT EXISTS sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id),
  product_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL DEFAULT 0
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_stock_level ON products(stock_level);
CREATE INDEX IF NOT EXISTS idx_products_expiry_date ON products(expiry_date);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_sales_staff_id ON sales(staff_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Super admins can read all profiles" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'super_admin' AND is_active = true
    )
  );

CREATE POLICY "Super admins can insert profiles" ON profiles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'super_admin' AND is_active = true
    )
  );

CREATE POLICY "Super admins can update all profiles" ON profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'super_admin' AND is_active = true
    )
  );

CREATE POLICY "Super admins can delete profiles" ON profiles
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'super_admin' AND is_active = true
    )
  );

-- Products policies
CREATE POLICY "All active users can read products" ON products
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Super admins and pharmtech can insert products" ON products
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role IN ('super_admin', 'pharmtech') AND is_active = true
    )
  );

CREATE POLICY "Super admins and pharmtech can update products" ON products
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role IN ('super_admin', 'pharmtech') AND is_active = true
    )
  );

CREATE POLICY "Super admins and pharmtech can delete products" ON products
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role IN ('super_admin', 'pharmtech') AND is_active = true
    )
  );

-- Sales policies
CREATE POLICY "All active users can read sales" ON sales
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "All active users can insert sales" ON sales
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND is_active = true
    ) AND staff_id = auth.uid()
  );

-- Sale items policies
CREATE POLICY "All active users can read sale items" ON sale_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "All active users can insert sale items" ON sale_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales s 
      INNER JOIN profiles p ON s.staff_id = p.id
      WHERE s.id = sale_id AND p.id = auth.uid() AND p.is_active = true
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at 
  BEFORE UPDATE ON profiles 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at 
  BEFORE UPDATE ON products 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data
INSERT INTO products (name, category, supplier, batch_number, expiry_date, cost_price, selling_price, stock_level, min_stock_level, barcode, requires_prescription) VALUES
('Panadol Extra', 'Pain Relief', 'GlaxoSmithKline', 'PE2024001', '2025-12-31', 120, 150, 250, 50, '1234567890123', false),
('Amoxicillin 500mg', 'Antibiotics', 'Cipla Kenya', 'AM2024002', '2024-06-30', 300, 350, 15, 25, '1234567890124', true),
('Vitamin C Tablets', 'Supplements', 'Cosmos Limited', 'VC2024003', '2026-08-15', 80, 120, 180, 30, '1234567890125', false),
('Cough Syrup', 'Cold & Flu', 'Shelys Pharmaceuticals', 'CS2024004', '2024-03-15', 150, 200, 45, 20, '1234567890126', false),
('Aspirin 100mg', 'Pain Relief', 'Bayer', 'AS2024005', '2025-09-30', 90, 120, 300, 50, '1234567890127', false);