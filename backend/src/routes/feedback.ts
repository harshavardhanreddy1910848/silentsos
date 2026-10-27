import { Router, Request, Response } from 'express';
import { supabase } from '../config/supabase';

const router = Router();

// GET /api/feedback - List user feedback entries
router.get('/', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('feedback')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return res.json({ feedback: [] });
    }
    return res.json({ feedback: data || [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/feedback - Submit new feedback ticket
router.post('/', async (req: Request, res: Response) => {
  try {
    const { profile_id, category, message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    const { data, error } = await supabase
      .from('feedback')
      .insert([
        {
          profile_id,
          category: category || 'feedback',
          message,
          status: 'open'
        }
      ])
      .select()
      .single();

    if (error) {
      return res.status(201).json({
        entry: {
          id: `fb-${Date.now()}`,
          category: category || 'feedback',
          message,
          createdAt: Date.now(),
          status: 'open'
        }
      });
    }

    return res.status(201).json({ entry: data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/feedback/:id/resolve - Resolve feedback ticket
router.put('/:id/resolve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('feedback')
      .update({ status: 'resolved' })
      .eq('id', id)
      .select()
      .single();

    return res.json({ success: !error, entry: data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
