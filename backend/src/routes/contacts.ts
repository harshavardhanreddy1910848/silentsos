import { Router, Request, Response } from 'express';
import { supabase } from '../config/supabase';

const router = Router();

// GET /api/contacts - Retrieve emergency contacts
router.get('/', async (req: Request, res: Response) => {
  try {
    const { profile_id } = req.query;

    let query = supabase.from('contacts').select('*');
    if (profile_id) {
      query = query.eq('profile_id', profile_id);
    }

    const { data, error } = await query;
    if (error) {
      return res.json({ contacts: [] });
    }
    return res.json({ contacts: data || [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/contacts - Add emergency contact
router.post('/', async (req: Request, res: Response) => {
  try {
    const { profile_id, name, phone, email, prefs } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Contact name is required' });
    }

    const { data, error } = await supabase
      .from('contacts')
      .insert([
        {
          profile_id,
          name,
          phone: phone || '',
          email: email || '',
          prefs: prefs || { gps: true, photos: true, video: true, audio: true, message: true }
        }
      ])
      .select()
      .single();

    if (error) {
      return res.status(201).json({
        contact: { id: `contact-${Date.now()}`, name, phone, email, prefs }
      });
    }

    return res.status(201).json({ contact: data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/contacts/:id - Delete emergency contact
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('contacts').delete().eq('id', id);
    return res.json({ success: !error });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
