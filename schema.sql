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

-- Ensure all missing columns exist in the 'apps' table
DO $$ 
BEGIN
    -- Ensure paypal_subscription_id column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'apps' AND column_name = 'paypal_subscription_id') THEN
        ALTER TABLE apps ADD COLUMN paypal_subscription_id VARCHAR(255) UNIQUE;
    END IF;

    -- Ensure plan_id column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'apps' AND column_name = 'plan_id') THEN
        ALTER TABLE apps ADD COLUMN plan_id VARCHAR(255);
    END IF;

    -- Ensure subscription_status column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'apps' AND column_name = 'subscription_status') THEN
        ALTER TABLE apps ADD COLUMN subscription_status VARCHAR(50) DEFAULT 'Pending';
    END IF;

    -- Ensure start_date column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'apps' AND column_name = 'start_date') THEN
        ALTER TABLE apps ADD COLUMN start_date TIMESTAMP DEFAULT NULL;
    END IF;

    -- Ensure next_billing_date column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'apps' AND column_name = 'next_billing_date') THEN
        ALTER TABLE apps ADD COLUMN next_billing_date TIMESTAMP DEFAULT NULL;
    END IF;

    -- Ensure last_payment_date column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'apps' AND column_name = 'last_payment_date') THEN
        ALTER TABLE apps ADD COLUMN last_payment_date TIMESTAMP DEFAULT NULL;
    END IF;

    -- Ensure cancel_date column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'apps' AND column_name = 'cancel_date') THEN
        ALTER TABLE apps ADD COLUMN cancel_date TIMESTAMP DEFAULT NULL;
    END IF;
END $$;

-- Drop the trigger if it exists, then recreate it
DROP TRIGGER IF EXISTS set_updated_at ON apps;

CREATE TRIGGER set_updated_at
BEFORE UPDATE ON apps
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
