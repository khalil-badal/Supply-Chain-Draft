import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../db';
import { clearSessionCookie, requireAuth, setSessionCookie, signToken } from '../middleware/auth';

const router = Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase() } });
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  if (!user.isActive) {
    return res.status(401).json({ error: 'Account is deactivated' });
  }

  const token = signToken({ id: user.id, name: user.name, email: user.email, role: user.role as any });
  setSessionCookie(res, token);
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
});

router.post('/logout', (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req: Request, res: Response) => {
  const perms = await prisma.userPermission.findMany({ where: { userId: req.user!.id } });
  res.json({
    ...req.user,
    permissions: perms.map(p => ({ screen: p.screen, granted: p.granted }))
  });
});

export default router;
