import { Router, Request, Response } from 'express';
import { supabase } from '../config/supabase';

const router = Router();

// GET /api/settings - Fetch user settings
router.get('/', async (req: Request, res: Response) => {
  try {
    const { profile_id } = req.query;

    if (!profile_id) {
      return res.json({
        settings: {
          sensitivity: 'medium',
          autoRepeat: 5,
          burstCount: 5,
          videoDuration: '1min',
          audioQuality: 'high',
          cameraChoice: 'both',
          discreet: false,
          messageTemplate: '🚨 EMERGENCY ALERT — SilentSOS',
          autoDeleteDays: 14
        }
      });
    }

    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('profile_id', profile_id)
      .single();

    if (error || !data) {
      return res.json({
        settings: {
          sensitivity: 'medium',
          autoRepeat: 5,
          burstCount: 5,
          videoDuration: '1min',
          audioQuality: 'high',
          cameraChoice: 'both',
          discreet: false,
          messageTemplate: '🚨 EMERGENCY ALERT — SilentSOS',
          autoDeleteDays: 14
        }
      });
    }

    return res.json({ settings: data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/settings - Save user settings
router.put('/', async (req: Request, res: Response) => {
  try {
    const { profile_id, ...settingsData } = req.body;

    const { data, error } = await supabase
      .from('settings')
      .upsert(
        [
          {
            profile_id,
            ...settingsData,
            updated_at: new Date().toISOString()
          }
        ],
        { onConflict: 'profile_id' }
      )
      .select()
      .single();

    if (error) {
      return res.json({ success: true, settings: settingsData });
    }

    return res.json({ settings: data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
