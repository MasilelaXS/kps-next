-- Insert test users for KPS Pest Control API
-- Run this SQL to create test accounts
-- NOTE: All test users have password: password123

USE kpspestcontrol_app;

-- Generate correct password hash for password123
-- Hash: $2y$12$MgzljKBIHMCFxzRu1X.dt.N59Bra7rWyb5KlgmjTDVeOAG63maUmC

-- Insert admin user (pco_number: 12345, password: password123)
INSERT INTO users (
    pco_number,
    name,
    email,
    phone,
    password_hash,
    role,
    status,
    created_at
) VALUES (
    '12345',
    'Admin User',
    'admin@kpspestcontrol.co.za',
    '+27123456789',
    '$2y$12$MgzljKBIHMCFxzRu1X.dt.N59Bra7rWyb5KlgmjTDVeOAG63maUmC',
    'admin',
    'active',
    NOW()
);

-- Insert PCO user (pco_number: 67890, password: password123)
INSERT INTO users (
    pco_number,
    name,
    email,
    phone,
    password_hash,
    role,
    status,
    created_at
) VALUES (
    '67890',
    'John PCO',
    'pco@kpspestcontrol.co.za',
    '+27987654321',
    '$2y$12$MgzljKBIHMCFxzRu1X.dt.N59Bra7rWyb5KlgmjTDVeOAG63maUmC',
    'pco',
    'active',
    NOW()
);

-- Insert both role user (pco_number: 11111, password: password123)
INSERT INTO users (
    pco_number,
    name,
    email,
    phone,
    password_hash,
    role,
    status,
    created_at
) VALUES (
    '11111',
    'Both Admin PCO',
    'both@kpspestcontrol.co.za',
    '+27111111111',
    '$2y$12$MgzljKBIHMCFxzRu1X.dt.N59Bra7rWyb5KlgmjTDVeOAG63maUmC',
    'both',
    'active',
    NOW()
);

-- Verify insertions
SELECT 
    id,
    pco_number,
    name,
    email,
    role,
    status,
    created_at
FROM users
ORDER BY id;
