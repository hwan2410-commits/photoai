create extension if not exists "uuid-ossp";

create table if not exists photo_edits (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  original_url text not null,
  edited_url text,
  purpose text not null,
  corrections jsonb,
  gemini_analysis jsonb,
  groq_feedback jsonb,
  score integer,
  created_at timestamptz default now()
);

alter table photo_edits enable row level security;
create policy "Users can manage own edits" on photo_edits for all using (auth.uid() = user_id);
