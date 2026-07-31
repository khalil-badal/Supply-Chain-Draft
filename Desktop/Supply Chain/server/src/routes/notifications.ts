import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' },
    take: 50
  });
  res.json(
    notifications.map(n => ({
      id: n.id,
      title: n.title,
      message: n.message,
      record_id: n.recordId,
      record_type: n.recordType,
      is_read: n.isRead,
      created_at: n.createdAt
    }))
  );
});

router.get('/unread-count', requireAuth, async (req, res) => {
  const count = await prisma.notification.count({
    where: { userId: req.user!.id, isRead: false }
  });
  res.json({ count });
});

router.patch('/read-all', requireAuth, async (req, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.user!.id, isRead: false },
    data: { isRead: true }
  });
  res.json({ ok: true });
});

router.patch('/:id/read', requireAuth, async (req, res) => {
  const notif = await prisma.notification.findFirst({
    where: { id: req.params.id, userId: req.user!.id }
  });
  if (!notif) return res.status(404).json({ error: 'Notification not found' });

  await prisma.notification.update({
    where: { id: notif.id },
    data: { isRead: true }
  });
  res.json({ ok: true });
});

export default router;
