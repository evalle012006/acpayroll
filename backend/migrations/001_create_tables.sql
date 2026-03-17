-- Branches
CREATE TABLE IF NOT EXISTS public.branches (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Staff
CREATE TABLE IF NOT EXISTS public.staff (
  id SERIAL PRIMARY KEY,
  employee_no VARCHAR(50),
  last_name VARCHAR(100) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  middle_name VARCHAR(100),
  fullname VARCHAR(255),
  position VARCHAR(100),
  department VARCHAR(100),
  branch_id INT REFERENCES public.branches(id),
  salary NUMERIC(12,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'Active',
  start_date DATE,
  regularization_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
  -- add more columns as needed
);

-- Users (for auth)
CREATE TABLE IF NOT EXISTS public.users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(50) DEFAULT 'branch manager',
  branch_id INT REFERENCES public.branches(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order sequences (used in your routes)
CREATE TABLE IF NOT EXISTS public.order_sequences (
  prefix VARCHAR(20) NOT NULL,
  year INT NOT NULL,
  month INT NOT NULL,
  next_value INT DEFAULT 1,
  PRIMARY KEY (prefix, year, month)
);