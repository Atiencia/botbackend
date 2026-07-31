-- 1. Habilitar extensión para UUIDs y Vector (Embeddings)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- Limpiar tablas antiguas si existen
DROP TABLE IF EXISTS public.knowledge CASCADE;
DROP TABLE IF EXISTS public.chats CASCADE;
DROP TABLE IF EXISTS public.bot_configs CASCADE;

-- ... [bot_configs table remains unchanged here] ...

-- 3. Tabla de Base de Conocimiento (knowledge)
CREATE TABLE public.knowledge (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    category TEXT NOT NULL,
    content TEXT NOT NULL,
    embedding vector(384), -- Almacenará los embeddings locales de Xenova
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3.5. Función para Búsqueda Semántica de Conocimiento
CREATE OR REPLACE FUNCTION match_knowledge (
  query_embedding vector(384),
  match_threshold float,
  match_count int,
  p_user_id uuid
)
RETURNS TABLE (
  id uuid,
  content text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    id,
    content,
    1 - (knowledge.embedding <=> query_embedding) AS similarity
  FROM knowledge
  WHERE user_id = p_user_id
    AND 1 - (knowledge.embedding <=> query_embedding) > match_threshold
  ORDER BY knowledge.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- 4. Tabla de Chats (chats)
CREATE TABLE public.chats (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    instagram_user_id TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role TEXT CHECK (role IN ('user', 'assistant', 'system')) NOT NULL,
    content TEXT NOT NULL,
    meta_message_id TEXT UNIQUE, -- ID del mensaje de Meta para evitar procesar duplicados
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Trigger para actualizar automáticamente el updated_at
CREATE OR REPLACE FUNCTION update_modified_column() 
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$ language 'plpgsql';

CREATE TRIGGER update_bot_configs_modtime 
BEFORE UPDATE ON public.bot_configs 
FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- 6. Habilitar Seguridad a Nivel de Fila (RLS)
ALTER TABLE public.bot_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

-- 7. Crear Políticas de Seguridad (Solo el dueño puede ver/editar sus datos)
-- Políticas para bot_configs
CREATE POLICY "Users can view their own bot config" ON public.bot_configs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own bot config" ON public.bot_configs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own bot config" ON public.bot_configs FOR UPDATE USING (auth.uid() = user_id);

-- Políticas para knowledge
CREATE POLICY "Users can view their own knowledge" ON public.knowledge FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own knowledge" ON public.knowledge FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own knowledge" ON public.knowledge FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own knowledge" ON public.knowledge FOR DELETE USING (auth.uid() = user_id);

-- Políticas para chats
CREATE POLICY "Users can view their own chats" ON public.chats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own chats" ON public.chats FOR INSERT WITH CHECK (auth.uid() = user_id);
