-- Add l_number column to chemicals table
-- This will store the L-number (registration/license number) for each chemical

ALTER TABLE chemicals 
ADD COLUMN l_number VARCHAR(50) NULL AFTER active_ingredients;

-- Update existing chemicals with their L-numbers (update these as needed)
-- Examples:
-- UPDATE chemicals SET l_number = 'L12345' WHERE id = 1;
-- UPDATE chemicals SET l_number = 'L67890' WHERE id = 2;
