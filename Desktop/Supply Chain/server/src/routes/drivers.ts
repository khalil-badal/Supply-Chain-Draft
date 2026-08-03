import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

// List all drivers (active only by default, ?all=1 for all)
router.get('/', requireAuth, async (req, res) => {
  const where = req.query.all === '1' ? {} : { isActive: true };
  const drivers = await prisma.driver.findMany({ where, orderBy: { name: 'asc' } });
  res.json(
    drivers.map(d => ({
      id: d.id,
      name: d.name,
      type: d.type,
      coverage_areas: JSON.parse(d.coverageAreas || '[]') as string[],
      is_active: d.isActive,
      created_by: d.createdBy,
      created_at: d.createdAt,
      modified_by: d.modifiedBy,
      modified_at: d.modifiedAt,
    }))
  );
});

// Create a driver — Logistics + Admin only
router.post('/', requireAuth, requireRole('LOGISTICS', 'ADMIN'), async (req, res) => {
  const { name, type, coverage_areas } = req.body ?? {};
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  const driverType = type === 'ASSISTANT' ? 'ASSISTANT' : 'DRIVER';

  const created = await prisma.driver.create({
    data: {
      name: name.trim(),
      type: driverType,
      coverageAreas: JSON.stringify(coverage_areas ?? []),
      createdBy: req.user!.name,
      modifiedBy: req.user!.name,
    },
  });
  res.status(201).json({
    id: created.id,
    name: created.name,
    type: created.type,
    coverage_areas: JSON.parse(created.coverageAreas) as string[],
    is_active: created.isActive,
    created_by: created.createdBy,
    created_at: created.createdAt,
    modified_by: created.modifiedBy,
    modified_at: created.modifiedAt,
  });
});

// Update a driver — Logistics + Admin only
router.put('/:id', requireAuth, requireRole('LOGISTICS', 'ADMIN'), async (req, res) => {
  const { name, type, coverage_areas, is_active } = req.body ?? {};
  const existing = await prisma.driver.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Driver not found' });

  const updated = await prisma.driver.update({
    where: { id: req.params.id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(type !== undefined && { type: type === 'ASSISTANT' ? 'ASSISTANT' : 'DRIVER' }),
      ...(coverage_areas !== undefined && { coverageAreas: JSON.stringify(coverage_areas) }),
      ...(is_active !== undefined && { isActive: is_active }),
      modifiedBy: req.user!.name,
    },
  });
  res.json({
    id: updated.id,
    name: updated.name,
    type: updated.type,
    coverage_areas: JSON.parse(updated.coverageAreas) as string[],
    is_active: updated.isActive,
    created_by: updated.createdBy,
    created_at: updated.createdAt,
    modified_by: updated.modifiedBy,
    modified_at: updated.modifiedAt,
  });
});

// Delete a driver — Logistics + Admin only (soft-delete via is_active=false preferred, but hard-delete supported)
router.delete('/:id', requireAuth, requireRole('LOGISTICS', 'ADMIN'), async (req, res) => {
  const existing = await prisma.driver.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Driver not found' });
  await prisma.driver.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

export default router;
