-- Ensure the table exists
CREATE TABLE IF NOT EXISTS apps (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255) UNIQUE NOT NULL,
    website VARCHAR(255),
    password VARCHAR(255) NOT NULL,
    situation VARCHAR(50) DEFAULT 'Pending',
    app_name VARCHAR(255) DEFAULT 'DefaultAppName',
    app_type VARCHAR(50) DEFAULT NULL,
    visitors TEXT DEFAULT 0,
    country VARCHAR(50) DEFAULT NULL,
    icon TEXT DEFAULT NULL,
    splash_icon TEXT DEFAULT NULL,
    customization VARCHAR(255) DEFAULT NULL,
    features TEXT DEFAULT NULL,
    app_design TEXT DEFAULT NULL,
    app_url TEXT,
    
     -- Subscription fields
    paypal_subscription_id VARCHAR(255) UNIQUE,  -- Stores PayPal Subscription ID
    plan_id VARCHAR(255),                         -- Stores PayPal Plan ID (monthly/annual)
    subscription_status VARCHAR(50) DEFAULT 'Pending', -- Active, Cancelled, Failed, etc.
    start_date TIMESTAMP DEFAULT NULL,            -- When the subscription starts
    next_billing_date TIMESTAMP DEFAULT NULL,     -- When the next payment is due
    last_payment_date TIMESTAMP DEFAULT NULL,     -- When the last payment was made
    cancel_date TIMESTAMP DEFAULT NULL,  
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create or replace the trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = CURRENT_TIMESTAMP;
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure subscription_status column exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'apps' AND column_name = 'subscription_status') THEN
        ALTER TABLE apps ADD COLUMN subscription_status VARCHAR(50) DEFAULT 'Pending';
    END IF;
END $$;

-- Drop the trigger if it exists, then recreate it
DROP TRIGGER IF EXISTS set_updated_at ON apps;

CREATE TRIGGER set_updated_at
BEFORE UPDATE ON apps
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
