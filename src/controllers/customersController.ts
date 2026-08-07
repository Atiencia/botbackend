import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { supabase } from '../config/supabase';
import { logger } from '../config/logger';

export const getCustomers = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    res.status(200).json(data);
  } catch (err) {
    logger.error('Error fetching customers:', err);
    res.status(500).json({ error: 'Error fetching customers' });
  }
};

export const toggleBotActive = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { platform_user_id } = req.params;
    const { is_bot_active } = req.body;

    const { data, error } = await supabase
      .from('customers')
      .update({ is_bot_active })
      .eq('platform_user_id', platform_user_id)
      .eq('user_id', userId)
      .select();

    if (error) throw error;
    res.status(200).json(data[0]);
  } catch (err) {
    logger.error('Error toggling bot active status:', err);
    res.status(500).json({ error: 'Error updating customer status' });
  }
};
