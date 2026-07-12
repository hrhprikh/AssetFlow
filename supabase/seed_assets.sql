-- ============================================================
-- AssetFlow — Dummy Data Seed Script
-- Run this in Supabase SQL Editor
-- This will populate Departments, Categories, and Assets.
-- ============================================================

DO $$
DECLARE
  dept_eng UUID;
  dept_design UUID;
  dept_hr UUID;
  
  cat_laptops UUID;
  cat_monitors UUID;
  cat_furniture UUID;
  cat_av UUID;
BEGIN
  -- 1. Create or Fetch Departments
  SELECT id INTO dept_eng FROM public.departments WHERE code = 'ENG';
  IF dept_eng IS NULL THEN
    INSERT INTO public.departments (name, code, status) VALUES ('Engineering', 'ENG', 'ACTIVE') RETURNING id INTO dept_eng;
  END IF;

  SELECT id INTO dept_design FROM public.departments WHERE code = 'DSN';
  IF dept_design IS NULL THEN
    INSERT INTO public.departments (name, code, status) VALUES ('Design', 'DSN', 'ACTIVE') RETURNING id INTO dept_design;
  END IF;

  SELECT id INTO dept_hr FROM public.departments WHERE code = 'HR';
  IF dept_hr IS NULL THEN
    INSERT INTO public.departments (name, code, status) VALUES ('Human Resources', 'HR', 'ACTIVE') RETURNING id INTO dept_hr;
  END IF;

  -- 2. Create or Fetch Asset Categories
  SELECT id INTO cat_laptops FROM public.asset_categories WHERE name = 'Laptops';
  IF cat_laptops IS NULL THEN
    INSERT INTO public.asset_categories (name, description, status) VALUES ('Laptops', 'Company issued laptops', 'ACTIVE') RETURNING id INTO cat_laptops;
  END IF;

  SELECT id INTO cat_monitors FROM public.asset_categories WHERE name = 'Monitors';
  IF cat_monitors IS NULL THEN
    INSERT INTO public.asset_categories (name, description, status) VALUES ('Monitors', 'External displays', 'ACTIVE') RETURNING id INTO cat_monitors;
  END IF;

  SELECT id INTO cat_furniture FROM public.asset_categories WHERE name = 'Furniture';
  IF cat_furniture IS NULL THEN
    INSERT INTO public.asset_categories (name, description, status) VALUES ('Furniture', 'Desks, chairs, and cabinets', 'ACTIVE') RETURNING id INTO cat_furniture;
  END IF;

  SELECT id INTO cat_av FROM public.asset_categories WHERE name = 'A/V Equipment';
  IF cat_av IS NULL THEN
    INSERT INTO public.asset_categories (name, description, status) VALUES ('A/V Equipment', 'Projectors, microphones, and cameras', 'ACTIVE') RETURNING id INTO cat_av;
  END IF;

  -- 3. Create Assets safely (ignoring duplicates by asset_tag)
  -- Laptops (Engineering)
  INSERT INTO public.assets (asset_tag, name, category_id, serial_number, acquisition_cost, condition, location, current_department_id, is_bookable, status)
  VALUES 
    ('AF-1001', 'MacBook Pro 16" (M3 Max)', cat_laptops, 'C02ZG000MD6M', 3499.00, 'New', 'Floor 3, IT Locker', dept_eng, false, 'AVAILABLE'),
    ('AF-1002', 'MacBook Pro 14" (M3 Pro)', cat_laptops, 'C02ZG001MD6N', 1999.00, 'Good', 'Floor 3, IT Locker', dept_eng, false, 'AVAILABLE'),
    ('AF-1003', 'ThinkPad X1 Carbon Gen 11', cat_laptops, 'PF3ZQ123', 1799.00, 'Good', 'Floor 3, IT Locker', dept_eng, false, 'AVAILABLE')
  ON CONFLICT (asset_tag) DO NOTHING;

  -- Laptops (Design)
  INSERT INTO public.assets (asset_tag, name, category_id, serial_number, acquisition_cost, condition, location, current_department_id, is_bookable, status)
  VALUES 
    ('AF-1004', 'MacBook Pro 16" (M2 Max)', cat_laptops, 'C02ZG002MD6O', 3299.00, 'Fair', 'Floor 2, Design Studio', dept_design, false, 'AVAILABLE')
  ON CONFLICT (asset_tag) DO NOTHING;

  -- Monitors (Shared / General)
  INSERT INTO public.assets (asset_tag, name, category_id, serial_number, acquisition_cost, condition, location, current_department_id, is_bookable, status)
  VALUES 
    ('AF-2001', 'Dell UltraSharp 27" 4K', cat_monitors, 'DL-US27-001', 599.00, 'New', 'Floor 3, Open Seating', NULL, false, 'AVAILABLE'),
    ('AF-2002', 'Dell UltraSharp 27" 4K', cat_monitors, 'DL-US27-002', 599.00, 'New', 'Floor 3, Open Seating', NULL, false, 'AVAILABLE'),
    ('AF-2003', 'LG UltraFine 5K', cat_monitors, 'LG-UF5K-001', 1299.00, 'Good', 'Floor 2, Design Studio', dept_design, false, 'AVAILABLE')
  ON CONFLICT (asset_tag) DO NOTHING;

  -- Furniture
  INSERT INTO public.assets (asset_tag, name, category_id, acquisition_cost, condition, location, current_department_id, is_bookable, status)
  VALUES 
    ('AF-3001', 'Herman Miller Aeron Chair', cat_furniture, 1100.00, 'Good', 'Floor 3, Desk 12', NULL, false, 'AVAILABLE'),
    ('AF-3002', 'Herman Miller Aeron Chair', cat_furniture, 1100.00, 'Good', 'Floor 3, Desk 13', NULL, false, 'AVAILABLE'),
    ('AF-3003', 'Uplift Standing Desk V2', cat_furniture, 799.00, 'New', 'Floor 3, Desk 12', NULL, false, 'AVAILABLE')
  ON CONFLICT (asset_tag) DO NOTHING;

  -- Shared Bookable Resources (A/V Equipment)
  INSERT INTO public.assets (asset_tag, name, category_id, serial_number, acquisition_cost, condition, location, current_department_id, is_bookable, status)
  VALUES 
    ('AF-4001', 'Sony A7S III Camera Kit', cat_av, 'SNY-A7S-991', 3499.00, 'New', 'Floor 2, Media Room', dept_design, true, 'AVAILABLE'),
    ('AF-4002', 'Epson Pro EX9220 Projector', cat_av, 'EPS-PRO-001', 899.00, 'Good', 'Floor 4, Conference Room A', NULL, true, 'AVAILABLE'),
    ('AF-4003', 'Shure SM7B Microphone Setup', cat_av, 'SHR-SM7-002', 399.00, 'Good', 'Floor 2, Media Room', dept_design, true, 'AVAILABLE')
  ON CONFLICT (asset_tag) DO NOTHING;

END $$;
