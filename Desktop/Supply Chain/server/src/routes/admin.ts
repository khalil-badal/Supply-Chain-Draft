import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

// Full audit log with pagination and optional filters — ADMIN only.
router.get('/audit-log', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
  const limit = Math.max(1, Math.min(200, parseInt(String(req.query.limit ?? '50'), 10)));
  const skip = (page - 1) * limit;

  const where: any = {};

  if (req.query.userId) {
    where.changedById = String(req.query.userId);
  }

  const validActions = ['CREATE', 'UPDATE', 'DELETE'];
  if (req.query.action && validActions.includes(String(req.query.action))) {
    where.action = String(req.query.action);
  }

  if (req.query.from || req.query.to) {
    where.timestamp = {};
    if (req.query.from) where.timestamp.gte = new Date(String(req.query.from));
    if (req.query.to) where.timestamp.lte = new Date(String(req.query.to));
  }

  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { changedBy: true },
      orderBy: { timestamp: 'desc' },
      skip,
      take: limit
    }),
    prisma.auditLog.count({ where })
  ]);

  res.json({
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
    entries: entries.map(e => ({
      id: e.id,
      record_id: e.recordId,
      record_type: e.recordType,
      action: e.action,
      changed_by: e.changedBy.name,
      changed_by_id: e.changedById,
      timestamp: e.timestamp
    }))
  });
});

export default router;
