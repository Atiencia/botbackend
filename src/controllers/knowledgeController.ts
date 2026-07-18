import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { supabase } from '../config/supabase';
import { logger } from '../config/logger';

export const getKnowledge = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { data, error } = await supabase
      .from('knowledge')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.status(200).json(data);
  } catch (err) {
    logger.error('Error fetching knowledge:', err);
    res.status(500).json({ error: 'Error fetching knowledge' });
  }
};

export const addKnowledge = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { category, content } = req.body;

    if (!category || !content) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data, error } = await supabase
      .from('knowledge')
      .insert([{ user_id: userId, category, content }])
      .select();

    if (error) throw error;
    res.status(201).json(data ? data[0] : null);
  } catch (err) {
    logger.error('Error adding knowledge:', err);
    res.status(500).json({ error: 'Error creating knowledge' });
  }
};

export const deleteKnowledge = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    const { error } = await supabase
      .from('knowledge')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
    res.status(200).json({ success: true });
  } catch (err) {
    logger.error('Error deleting knowledge:', err);
    res.status(500).json({ error: 'Error deleting knowledge' });
  }
};
