import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import contactRoutes from './routes/contacts';
import settingsRoutes from './routes/settings';
import alertRoutes from './routes/alerts';
import feedbackRoutes from './routes/feedback';
import { verifyResendConnection } from './services/emailService';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// MIDDLEWARES
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// HEALTH CHECK ENDPOINT
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'online',
    app: 'SilentSOS Emergency Alert Backend',
    database: 'Supabase DB',
    emailService: 'Resend Official API',
    resend: {
      configured: !!process.env.RESEND_API_KEY,
      sender: process.env.RESEND_FROM || 'SilentSOS Emergency Alert <onboarding@resend.dev>'
    },
    timestamp: new Date().toISOString()
  });
});

// MOUNT ROUTES
app.use('/api/auth', authRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/emergency', alertRoutes); // Alias for /api/emergency/send-alerts
app.use('/api/feedback', feedbackRoutes);

// START SERVER & VERIFY RESEND API CONNECTION
app.listen(PORT, async () => {
  console.log(`🚀 SilentSOS Node.js + Express Backend running on http://localhost:${PORT}`);
  console.log(`⚡ Connected to Supabase Database configuration`);
  // Verify Resend Official API Connection
  await verifyResendConnection();
});
