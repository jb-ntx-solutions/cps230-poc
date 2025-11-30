-- Test creating a control directly in SQL to see if there are any database-level issues
-- Run this in Supabase SQL Editor

INSERT INTO public.controls (
    control_name,
    description,
    modified_by
) VALUES (
    'Test Control',
    'This is a test control to verify database constraints',
    'test@example.com'
)
RETURNING *;

-- If this works, the issue is with the Edge Function or RLS policies
-- If this fails, there's a database constraint issue

-- Clean up the test
DELETE FROM public.controls WHERE control_name = 'Test Control' AND modified_by = 'test@example.com';
