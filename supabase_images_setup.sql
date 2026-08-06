-- 1. Crear el bucket público para las imágenes del chat
insert into storage.buckets (id, name, public)
values ('chat-images', 'chat-images', true)
on conflict (id) do nothing;

-- 2. Habilitar RLS en la tabla de storage.objects
alter table storage.objects enable row level security;

-- 3. Crear política para que CUALQUIER USUARIO AUTENTICADO pueda subir imágenes
create policy "Usuarios autenticados pueden subir imágenes"
on storage.objects for insert
to authenticated
with check (
    bucket_id = 'chat-images' 
    -- Opcional: restringir al tamaño del archivo o tipo
);

-- 4. Crear política para que CUALQUIERA (público) pueda ver/descargar las imágenes
-- Esto es necesario porque Meta Graph API necesita descargar la imagen usando la URL pública
create policy "Cualquiera puede ver las imágenes del chat"
on storage.objects for select
to public
using ( bucket_id = 'chat-images' );

-- 5. Crear política para que el usuario pueda borrar sus propias imágenes si quiere (opcional)
create policy "Usuarios pueden borrar sus imágenes"
on storage.objects for delete
to authenticated
using ( bucket_id = 'chat-images' AND (auth.uid() = owner) );
