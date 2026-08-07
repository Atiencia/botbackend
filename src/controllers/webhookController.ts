import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { logger } from '../config/logger';
import { metaService } from '../services/MetaService';
import { aiService } from '../services/AIService';
import { embeddingService } from '../services/EmbeddingService';

/**
 * GET: Verificación del Webhook por parte de Meta
 */
export const verifyWebhook = async (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token) {
    try {
      // Buscamos si existe algun bot con este verify_token
      const { data, error } = await supabase
        .from('bot_configs')
        .select('id')
        .eq('meta_verify_token', token)
        .single();

      if (data && !error) {
        logger.info('Webhook verified successfully by Meta.');
        return res.status(200).send(challenge);
      }
    } catch (err) {
      logger.error('Database error during webhook verification', err);
    }
    
    logger.warn(`Webhook verification failed for token: ${token}`);
    return res.sendStatus(403);
  }

  res.sendStatus(400);
};

/**
 * POST: Recepción de mensajes de Instagram/Messenger
 */
export const handleIncomingMessage = async (req: Request, res: Response) => {
  const body = req.body;

  // Verificamos si es un evento de pagina
  if (body.object === 'instagram' || body.object === 'page') {
    let platform = 'instagram';
    if (body.object === 'page') {
      platform = 'messenger';
    }
    for (const entry of body.entry) {
      // El ID de la pagina de Instagram/Facebook
      const pageId = entry.id;

      // Por ahora es un MVP. En un SaaS real, buscariamos el bot_config usando este pageId.
      // Como MVP, simplemente tomamos la configuracion del usuario activo.
      const { data: botConfig, error: botError } = await supabase
        .from('bot_configs')
        .select('*')
        .eq('is_active', true)
        .limit(1)
        .single();

      if (botError || !botConfig || !botConfig.meta_access_token) {
        logger.error(`No active bot config found to process message for page ${pageId}`);
        continue;
      }

      if (entry.messaging) {
        for (const webhookEvent of entry.messaging) {
          // Ignorar los "echoes" (mensajes que el propio bot o un humano mandó desde la página)
          if (webhookEvent.sender?.id === pageId) {
            continue;
          }

          // Solo procesamos mensajes de texto (ignoramos leidos, entregados, etc)
          if (webhookEvent.message && webhookEvent.message.text) {
            const senderId = webhookEvent.sender.id;
            const messageText = webhookEvent.message.text;
            const metaMessageId = webhookEvent.message.mid;

            logger.info(`Received message from ${senderId}: ${messageText}`);

            try {
              // 1. Guardar mensaje del usuario en BD
              const { error: insertError } = await supabase.from('chats').insert({
                platform_user_id: senderId,
                user_id: botConfig.user_id,
                role: 'user',
                content: messageText,
                meta_message_id: metaMessageId,
                platform
              });

              if (insertError) {
                // 23505 es el código de error de PostgreSQL para Unique Violation
                if (insertError.code === '23505') {
                  logger.info(`Message ${metaMessageId} already processed. Ignoring duplicate.`);
                  continue; // Saltamos este mensaje ya que lo procesamos antes
                } else {
                  throw insertError; // Si es otro error, lo lanzamos
                }
              }

              // 2. Registrar cliente y comprobar si el bot está pausado (Handoff a humano)
              const { data: customerData } = await supabase
                .from('customers')
                .select('is_bot_active')
                .eq('platform_user_id', senderId)
                .eq('user_id', botConfig.user_id)
                .single();

              // Si el cliente no existe, lo creamos
              if (!customerData) {
                await supabase.from('customers').insert({
                  platform_user_id: senderId,
                  user_id: botConfig.user_id,
                  platform
                });
              } else {
                // Actualizar timestamp
                await supabase.from('customers')
                  .update({ updated_at: new Date().toISOString() })
                  .eq('platform_user_id', senderId)
                  .eq('user_id', botConfig.user_id);
              }

              // Si un humano pauso el bot para este cliente, no hacemos nada más
              if (customerData && customerData.is_bot_active === false) {
                logger.info(`Bot is paused for customer ${senderId}. Skipping AI response.`);
                continue;
              }

              // 3. Búsqueda semántica de conocimiento (RAG real con pgvector)
              let knowledgeText = '';
              try {
                const queryEmbedding = await embeddingService.generateEmbedding(messageText);
                
                // Llamamos a la función de Postgres creada en supabase_setup.sql
                const { data: matches, error: matchError } = await supabase.rpc('match_knowledge', {
                  query_embedding: queryEmbedding,
                  match_threshold: 0.1, // Umbral muy bajo para ser permisivos
                  match_count: 4, // Traemos hasta los 4 fragmentos más relevantes
                  p_user_id: botConfig.user_id
                });

                if (matchError) throw matchError;

                if (matches && matches.length > 0) {
                  knowledgeText = matches.map((m: any) => m.content).join('\n\n');
                  logger.info(`Found ${matches.length} semantic matches for context.`);
                }
              } catch (embErr) {
                logger.error('Error in semantic search, falling back to full knowledge:', embErr);
                // Fallback clásico: si falla pgvector, traemos los primeros conocimientos
                const { data: fallbackData } = await supabase
                  .from('knowledge')
                  .select('content')
                  .eq('user_id', botConfig.user_id)
                  .limit(5);
                knowledgeText = fallbackData?.map(k => k.content).join('\n\n') || '';
              }

              // 4. Obtener Historial de Chat reciente (ultimos 10 mensajes)
              const { data: chatHistoryData } = await supabase
                .from('chats')
                .select('role, content')
                .eq('platform_user_id', senderId)
                .eq('user_id', botConfig.user_id)
                .order('timestamp', { ascending: false })
                .limit(10);

              const chatHistory = chatHistoryData 
                ? chatHistoryData.reverse().map(c => ({ role: c.role as 'user' | 'assistant', content: c.content }))
                : [];

              // 5. Generar respuesta con IA
              let aiResponse = await aiService.getBotResponse(
                botConfig.system_prompt,
                knowledgeText,
                chatHistory,
                messageText,
                botConfig.model,
                botConfig.temperature
              );

              // 5.1 Auto-Handoff Secreto
              if (aiResponse.includes('[HANDOFF]')) {
                // Pausamos el bot automáticamente
                await supabase.from('customers')
                  .update({ is_bot_active: false, updated_at: new Date().toISOString() })
                  .eq('platform_user_id', senderId)
                  .eq('user_id', botConfig.user_id);
                  
                logger.info(`Auto-Handoff triggered for customer ${senderId}. Bot muted.`);
                
                // Handoff silencioso: No enviamos nada a Meta ni guardamos respuesta del bot.
                // Saltamos al siguiente mensaje.
                continue;
              }

              // 6. Enviar respuesta por Graph API
              const sent = await metaService.sendMessage(senderId, aiResponse, botConfig.meta_access_token);

              if (sent) {
                // 7. Guardar respuesta del bot en BD
                await supabase.from('chats').insert({
                  platform_user_id: senderId,
                  user_id: botConfig.user_id,
                  role: 'assistant',
                  content: aiResponse,
                  platform
                });
                logger.info(`Successfully replied to ${senderId}`);
              }
            } catch (err) {
              logger.error('Error processing webhook event:', err);
            }
          }
        }
      }
    }
    
    // IMPORTANTE: En Vercel enviamos el status 200 al FINAL de todo el proceso.
    // Si lo enviamos al inicio, Vercel mata la función y nunca se ejecuta la IA.
    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
};
