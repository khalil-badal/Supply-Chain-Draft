import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

const DEFAULT_DRIVERS = [
  { name: 'Lando Navarro',     type: 'DRIVER',    areas: ['Makati', 'BGC', 'Taguig', 'Mandaluyong', 'San Juan', 'Pasig', 'Ortigas'] },
  { name: 'Manny Santos',      type: 'DRIVER',    areas: ['Quezon City', 'Marikina', 'Caloocan', 'Valenzuela', 'Malabon', 'Bulacan', 'Cainta', 'Antipolo'] },
  { name: 'Ronald de la Cruz', type: 'DRIVER',    areas: ['Manila', 'Parañaque', 'Pasay', 'Las Piñas', 'Muntinlupa', 'Cavite', 'Laguna', 'Batangas'] },
  { name: 'Jayson Reyes',      type: 'ASSISTANT', areas: [] },
  { name: 'Bong Alvarez',      type: 'ASSISTANT', areas: [] },
  { name: 'Ricky Mendoza',     type: 'ASSISTANT', areas: [] },
];

function serialize(d: any) {
  return {
    id: d.id,
    name: d.name,
    type: d.type,
    coverage_areas: JSON.parse(d.coverageAreas || '[]') as string[],
    is_active: d.isActive,
    created_by: d.createdBy,
    created_at: d.createdAt,
    modified_by: d.modifiedBy,
    modified_at: d.modifiedAt,
  };
}

// List all drivers (active only by default, ?all=1 for all)
// Auto-seeds the default drivers if the table is empty.
router.get('/', requireAuth, async (req, res) => {
  const total = await prisma.driver.count();
  if (total === 0) {
    await prisma.driver.createMany({
      data: DEFAULT_DRIVERS.map(d => ({
        name: d.name,
        type: d.type,
        coverageAreas: JSON.stringify(d.areas),
        createdBy: 'system',
        modifiedBy: 'system',
      })),
    });
  }
  const where = req.query.all === '1' ? {} : { isActive: true };
  const drivers = await prisma.driver.findMany({ where, orderBy: { name: 'asc' } });
  res.json(drivers.map(serialize));
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
  res.status(201).json(serialize(created));
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
  res.json(serialize(updated));
});

// Delete a driver — Logistics + Admin only (soft-delete via is_active=false preferred, but hard-delete supported)
router.delete('/:id', requireAuth, requireRole('LOGISTICS', 'ADMIN'), async (req, res) => {
  const existing = await prisma.driver.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Driver not found' });
  await prisma.driver.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

export default router;
