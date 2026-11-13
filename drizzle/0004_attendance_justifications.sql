CREATE TABLE IF NOT EXISTS attendance_justifications (
    id serial PRIMARY KEY,
    user_id integer NOT NULL REFERENCES users(id),
    attendance_date date NOT NULL,
    message text,
    attachment_url text,
    attachment_name text,
    created_by integer NOT NULL REFERENCES users(id),
    created_at timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS attendance_justifications_user_date_idx ON attendance_justifications(user_id, attendance_date);
