BEGIN;

CREATE TABLE IF NOT EXISTS public.suspension_extension_history (
    id BIGSERIAL PRIMARY KEY,

    suspension_order_id INTEGER NOT NULL
        REFERENCES public.suspension_orders(id),

    previous_end_date DATE NOT NULL,
    new_end_date DATE NOT NULL,

    previous_days NUMERIC NOT NULL,
    new_days NUMERIC NOT NULL,

    additional_days INTEGER NOT NULL,

    extension_reason TEXT NOT NULL,

    extended_by INTEGER,
    extended_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;