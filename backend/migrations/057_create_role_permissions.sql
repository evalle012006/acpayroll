BEGIN;

CREATE TABLE IF NOT EXISTS public.role_permissions (
    id SERIAL PRIMARY KEY,

    role VARCHAR(100) NOT NULL,
    module_name VARCHAR(100) NOT NULL,
    action_name VARCHAR(100) NOT NULL,

    allowed BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(role, module_name, action_name)
);

COMMIT;