create table if not exists dataset_records (
  id uuid primary key default gen_random_uuid(),
  brief text,
  targetUrl text,
  domains jsonb,
  v1 jsonb,
  v2 jsonb,
  competitors jsonb,
  screenshotUrl text,
  labelUrl text,
  promptUrl text,
  comfyImageUrl text,
  createdAt timestamp default now()
);
