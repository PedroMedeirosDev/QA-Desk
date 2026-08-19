-- QA Desk: evidências — prints + vídeos (até 50 MB)
-- Atualiza bucket `evidence` no Supabase Storage.

update storage.buckets
set
  file_size_limit = 52428800, -- 50 MB (alinha com multer no Desk)
  allowed_mime_types = array[
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-matroska',
    'video/3gpp'
  ]
where id = 'evidence';
