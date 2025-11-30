-- Consolidate regions settings
-- This migration removes the old 'available_regions' setting and ensures all accounts use 'regions'
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/rdqavrqfisyzwfqhckcp/sql/new

-- Delete the old 'available_regions' setting
DELETE FROM public.settings WHERE key = 'available_regions';

-- For accounts that don't have a 'regions' setting yet, create a default one
-- with common regions (AU, UK, US, NZ, SG)
INSERT INTO public.settings (key, value, description, modified_by)
SELECT
  'regions',
  '[
    {"name": "AU", "label": "Australia"},
    {"name": "UK", "label": "United Kingdom"},
    {"name": "US", "label": "United States"},
    {"name": "NZ", "label": "New Zealand"},
    {"name": "SG", "label": "Singapore"}
  ]'::jsonb,
  'Available regions for assignment to processes and controls',
  'system'
WHERE NOT EXISTS (
  SELECT 1 FROM public.settings WHERE key = 'regions'
);

-- Verify the settings
SELECT key, value, description
FROM public.settings
WHERE key IN ('regions', 'available_regions')
ORDER BY key;
