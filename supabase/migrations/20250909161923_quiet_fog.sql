/*
  # Complete Database Reset and Recreation for Pharmacy POS

  This migration completely resets the database and creates a fresh pharmacy management system.

  ## What this migration does:
  1. Drops all existing tables and functions
  2. Creates custom types for roles and payment methods
  3. Creates all required tables with proper relationships
  4. Sets up Row Level Security (RLS) policies
  5. Creates demo users and sample data
  6. Sets up proper indexes for performance

  ## Tables Created:
  - user_profiles: User management with roles
  - products: Inventory management
  - sales: Sales transactions
  - sale_items: Individual items in each sale
  - stock_movements: Stock tracking history

  ## Demo Accounts:
  - admin@pharmacy.com (Super Admin) - password: password
  - staff@pharmacy.com (Pharmtech) - password: password  
  - cashier@pharmacy.com (Cashier) - password: password
*/

-- Drop all existing tables and related objects
DROP TABLE IF EXISTS stock_movements CASCADE;
DROP TABLE IF EXISTS sale_items CASCADE;
DROP TABLE IF EXISTS sales CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;

-- Drop existing functions
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

-- Drop existing types
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS payment_method CASCADE;
DROP TYPE IF EXISTS movement_type CASCADE;

-- Create custom types
CREATE TYPE user_role AS ENUM ('super_admin', 'pharmtech', 'cashier');
CREATE TYPE payment_method AS ENUM ('cash', 'mpesa', 'card', 'insurance');
CREATE TYPE movement_type AS ENUM ('in', 'out', 'adjustment');

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create user profiles table
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    role user_role NOT NULL DEFAULT 'cashier',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create products table
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    supplier TEXT NOT NULL,
    batch_number TEXT NOT NULL,
    expiry_date DATE NOT NULL,
    cost_price DECIMAL(10,2) NOT NULL CHECK (cost_price >= 0),
    selling_price DECIMAL(10,2) NOT NULL CHECK (selling_price >= 0),
    stock_level INTEGER NOT NULL DEFAULT 0 CHECK (stock_level >= 0),
    minimum_stock INTEGER NOT NULL DEFAULT 0 CHECK (minimum_stock >= 0),
    barcode TEXT UNIQUE,
    description TEXT,
    prescription_required BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create sales table
CREATE TABLE sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_number TEXT UNIQUE NOT NULL,
    cashier_id UUID NOT NULL REFERENCES user_profiles(id),
    customer_name TEXT,
    customer_phone TEXT,
    total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
    payment_method payment_method NOT NULL,
    payment_reference TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create sale items table
CREATE TABLE sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
    total_price DECIMAL(10,2) NOT NULL CHECK (total_price >= 0),
    batch_number TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create stock movements table
CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id),
    movement_type movement_type NOT NULL,
    quantity INTEGER NOT NULL,
    reference TEXT NOT NULL,
    notes TEXT,
    created_by UUID NOT NULL REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_expiry ON products(expiry_date);
CREATE INDEX idx_sales_cashier ON sales(cashier_id);
CREATE INDEX idx_sales_date ON sales(created_at);
CREATE INDEX idx_stock_movements_product ON stock_movements(product_id);

-- Add updated_at triggers
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_profiles
CREATE POLICY "Users can view their own profile"
    ON user_profiles FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

CREATE POLICY "Super admins can view all users"
    ON user_profiles FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid() 
            AND up.role = 'super_admin' 
            AND up.is_active = true
        )
    );

CREATE POLICY "Super admins can manage users"
    ON user_profiles FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid() 
            AND up.role = 'super_admin' 
            AND up.is_active = true
        )
    );

-- RLS Policies for products
CREATE POLICY "Active users can view products"
    ON products FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid() 
            AND up.is_active = true
        )
    );

CREATE POLICY "Pharmtech and super admin can manage products"
    ON products FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid() 
            AND up.role IN ('super_admin', 'pharmtech') 
            AND up.is_active = true
        )
    );

-- RLS Policies for sales
CREATE POLICY "Active users can view sales"
    ON sales FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid() 
            AND up.is_active = true
        )
    );

CREATE POLICY "Active users can create sales"
    ON sales FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid() 
            AND up.is_active = true
        ) 
        AND cashier_id = auth.uid()
    );

-- RLS Policies for sale_items
CREATE POLICY "Active users can view sale items"
    ON sale_items FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid() 
            AND up.is_active = true
        )
    );

CREATE POLICY "Active users can create sale items"
    ON sale_items FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid() 
            AND up.is_active = true
        )
    );

-- RLS Policies for stock_movements
CREATE POLICY "Active users can view stock movements"
    ON stock_movements FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid() 
            AND up.is_active = true
        )
    );

CREATE POLICY "Active users can create stock movements"
    ON stock_movements FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid() 
            AND up.is_active = true
        ) 
        AND created_by = auth.uid()
    );

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_profiles (id, email, full_name, phone, role, is_active)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
        COALESCE(NEW.raw_user_meta_data->>'phone', ''),
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'cashier'),
        true
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user registration
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Insert demo users (these will be created in auth.users and trigger will create profiles)
DO $$
DECLARE
    admin_id UUID;
    staff_id UUID;
    cashier_id UUID;
BEGIN
    -- Create admin user
    INSERT INTO auth.users (
        id,
        instance_id,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        role
    ) VALUES (
        gen_random_uuid(),
        '00000000-0000-0000-0000-000000000000',
        'admin@pharmacy.com',
        crypt('password', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        '{"provider": "email", "providers": ["email"]}',
        '{"full_name": "System Administrator", "phone": "254700000001", "role": "super_admin"}',
        false,
        'authenticated'
    ) RETURNING id INTO admin_id;

    -- Create staff user
    INSERT INTO auth.users (
        id,
        instance_id,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        role
    ) VALUES (
        gen_random_uuid(),
        '00000000-0000-0000-0000-000000000000',
        'staff@pharmacy.com',
        crypt('password', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        '{"provider": "email", "providers": ["email"]}',
        '{"full_name": "Pharmacy Staff", "phone": "254700000002", "role": "pharmtech"}',
        false,
        'authenticated'
    ) RETURNING id INTO staff_id;

    -- Create cashier user
    INSERT INTO auth.users (
        id,
        instance_id,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        role
    ) VALUES (
        gen_random_uuid(),
        '00000000-0000-0000-0000-000000000000',
        'cashier@pharmacy.com',
        crypt('password', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        '{"provider": "email", "providers": ["email"]}',
        '{"full_name": "Cashier User", "phone": "254700000003", "role": "cashier"}',
        false,
        'authenticated'
    ) RETURNING id INTO cashier_id;

    -- Manually create user profiles (in case trigger doesn't work)
    INSERT INTO user_profiles (id, email, full_name, phone, role, is_active) VALUES
    (admin_id, 'admin@pharmacy.com', 'System Administrator', '254700000001', 'super_admin', true),
    (staff_id, 'staff@pharmacy.com', 'Pharmacy Staff', '254700000002', 'pharmtech', true),
    (cashier_id, 'cashier@pharmacy.com', 'Cashier User', '254700000003', 'cashier', true)
    ON CONFLICT (id) DO NOTHING;

END $$;

-- Insert sample products
INSERT INTO products (name, category, supplier, batch_number, expiry_date, cost_price, selling_price, stock_level, minimum_stock, barcode, prescription_required) VALUES
('Paracetamol 500mg', 'Pain Relief', 'PharmaCorp Ltd', 'PC001', '2025-12-31', 50.00, 80.00, 100, 20, '1234567890123', false),
('Amoxicillin 250mg', 'Antibiotics', 'MediSupply Co', 'MS002', '2025-06-30', 120.00, 180.00, 50, 10, '1234567890124', true),
('Vitamin C 1000mg', 'Supplements', 'HealthPlus', 'HP003', '2026-03-15', 80.00, 120.00, 75, 15, '1234567890125', false),
('Cough Syrup', 'Cold & Flu', 'ReliefMed', 'RM004', '2025-09-20', 150.00, 220.00, 30, 5, '1234567890126', false),
('Omeprazole 20mg', 'Digestive Health', 'GastroMed', 'GM005', '2025-11-10', 200.00, 300.00, 40, 8, '1234567890127', true),
('Aspirin 100mg', 'Heart & Blood', 'CardioPharm', 'CP006', '2025-08-25', 60.00, 90.00, 80, 16, '1234567890128', false),
('Hydrocortisone Cream', 'Skin Care', 'DermaCare', 'DC007', '2025-07-18', 180.00, 250.00, 25, 5, '1234567890129', false),
('Eye Drops', 'Eye Care', 'VisionMed', 'VM008', '2025-05-12', 120.00, 180.00, 35, 7, '1234567890130', false),
('Bandages', 'Medical Supplies', 'MedSupplies', 'MS009', '2027-01-01', 30.00, 50.00, 200, 40, '1234567890131', false),
('Thermometer', 'Medical Supplies', 'MedTech', 'MT010', '2030-01-01', 500.00, 750.00, 15, 3, '1234567890132', false);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- Refresh the schema cache
NOTIFY pgrst, 'reload schema';