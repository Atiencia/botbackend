import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { supabase } from '../config/supabase';
import { logger } from '../config/logger';
import { metaService } from '../services/MetaService';

export const getChats = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { data, error } = await supabase
      .from('chats')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false });

    if (error) throw error;
    res.status(200).json(data);
  } catch (err) {
    logger.error('Error fetching chats:', err);
    res.status(500).json({ error: 'Error fetching chats' });
  }
};

export const sendChatMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { instagram_user_id, message } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'No autorizado' });
      return;
    }

    if (!instagram_user_id || !message) {
      res.status(400).json({ error: 'instagram_user_id y message son requeridos' });
      return;
    }

    // 1. Obtener el token de Meta de la configuración del usuario
    const { data: botConfig, error: configError } = await supabase
      .from('bot_configs')
      .select('meta_page_access_token')
      .eq('user_id', userId)
      .single();

    if (configError || !botConfig?.meta_page_access_token) {
      logger.error('Error obteniendo config:', configError);
      res.status(400).json({ error: 'Falta configurar el Token de Meta' });
      return;
    }

    // 2. Enviar mensaje por Meta API
    const sent = await metaService.sendMessage(
      instagram_user_id,
      message,
      botConfig.meta_page_access_token
    );

    if (!sent) {
      res.status(500).json({ error: 'Falló el envío por la API de Meta' });
      return;
    }

    // 3. Guardar el mensaje enviado en la BD local como rol 'assistant' para el historial
    const { error: insertError } = await supabase
      .from('chats')
      .insert({
        user_id: userId,
        instagram_user_id,
        role: 'assistant',
        content: message
      });

    if (insertError) {
      logger.error('Error guardando mensaje manual:', insertError);
      // No hacemos throw porque el mensaje ya se envió a Meta
    }

    res.status(200).json({ success: true });
  } catch (err: any) {
    logger.error('Error enviando mensaje manual:', err.message);
    res.status(500).json({ error: 'Error enviando mensaje' });
  }
};
