-- 1. Habilitar extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Limpiar tablas antiguas si existen
DROP TABLE IF EXISTS public.knowledge CASCADE;
DROP TABLE IF EXISTS public.chats CASCADE;
DROP TABLE IF EXISTS public.bot_configs CASCADE;

-- 2. Tabla de configuración del bot (bot_configs)
CREATE TABLE public.bot_configs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    system_prompt TEXT DEFAULT 'Eres un asistente útil.',
    model TEXT DEFAULT 'llama-3.1-8b-instant',
    temperature NUMERIC DEFAULT 0.7,
    meta_access_token TEXT,
    meta_verify_token TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabla de Base de Conocimiento (knowledge)
CREATE TABLE public.knowledge (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    category TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Tabla de Chats (chats)
CREATE TABLE public.chats (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    instagram_user_id TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role TEXT CHECK (role IN ('user', 'assistant', 'system')) NOT NULL,
    content TEXT NOT NULL,
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
