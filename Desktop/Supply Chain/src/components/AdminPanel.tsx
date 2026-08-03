import React, { useState, useEffect } from 'react';
import { Users, ClipboardList, UserX, Plus, ChevronLeft, ChevronRight, Loader2, Check, ShieldCheck, RotateCcw, X } from 'lucide-react';
import { api, ApiUserAdmin, ApiAdminAuditEntry, ApiError } from '../api';

type Tab = 'users' | 'audit';

const ROLE_OPTIONS = ['SALES_COORDINATOR', 'LOGISTICS', 'TASS', 'ADMIN'] as const;
const ROLE_LABELS: Record<string, string> = {
  SALES_COORDINATOR: 'Sales Coordinator',
  LOGISTICS: 'Logistics',
  TASS: 'TASS',
  ADMIN: 'Admin'
};

const ALL_SCREENS = [
  'main', 'dashboard', 'deliveries', 'rma', 'accounting_collection',
  'procurement_pickup', 'sales_orders', 'customers', 'suppliers',
  'driver', 'driver_manager', 'calendar', 'driver_board', 'am_directory',
  'transactions', 'inventory', 'data_sampler', 'admin'
] as const;

const SCREEN_LABELS: Record<string, string> = {
  main: 'Main',
  dashboard: 'Dashboard',
  deliveries: 'Deliveries',
  rma: 'RMA',
  accounting_collection: 'Accounting Collection',
  procurement_pickup: 'Procurement Pick-up',
  sales_orders: 'Sales Orders',
  customers: 'Customers',
  suppliers: 'Suppliers',
  driver: 'Driver View',
  driver_manager: 'Driver Manager',
  calendar: 'Delivery Calendar',
  driver_board: 'Driver Board',
  am_directory: 'AM Directory',
  transactions: 'Transaction Center',
  inventory: 'SKU Master',
  data_sampler: 'Data Sampler',
  admin: 'Admin Panel',
};

const ROLE_DEFAULT_SCREENS: Record<string, string[]> = {
  SALES_COORDINATOR: ['main', 'dashboard', 'deliveries', 'rma', 'accounting_collection', 'procurement_pickup', 'sales_orders', 'customers', 'suppliers', 'am_directory', 'transactions', 'inventory'],
  LOGISTICS:         ['main', 'dashboard', 'deliveries', 'rma', 'accounting_collection', 'procurement_pickup', 'sales_orders', 'customers', 'suppliers', 'driver', 'driver_manager', 'calendar', 'driver_board', 'transactions', 'inventory'],
  TASS:              ['main', 'dashboard', 'accounting_collection', 'transactions'],
  ADMIN:             ['main', 'dashboard', 'deliveries', 'rma', 'accounting_collection', 'procurement_pickup', 'sales_orders', 'customers', 'suppliers', 'driver', 'driver_manager', 'admin', 'calendar', 'driver_board', 'am_directory', 'transactions', 'inventory', 'data_sampler'],
};

interface PermissionsPanelProps {
  user: ApiUserAdmin;
  onClose: () => void;
}

function PermissionsPanel({ user, onClose }: PermissionsPanelProps) {
  const roleDefaults = new Set(ROLE_DEFAULT_SCREENS[user.role] ?? []);
  const [toggles, setToggles] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.getUserPermissions(user.id)
      .then(({ permissions }) => {
        const base: Record<string, boolean> = {};
        for (const s of ALL_SCREENS) base[s] = roleDefaults.has(s);
        for (const p of permissions) base[p.screen] = p.granted;
        setToggles(base);
      })
      .catch(e => setError(e instanceof ApiError ? e.message : 'Failed to load permissions'))
      .finally(() => setLoading(false));
  }, [user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSavedOk(false);
    // Only send entries that differ from the role default
    const overrides = ALL_SCREENS
      .filter(s => toggles[s] !== roleDefaults.has(s))
      .map(s => ({ screen: s, granted: toggles[s] }));
    try {
      await api.setUserPermissions(user.id, overrides);
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2000);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.setUserPermissions(user.id, []);
      const base: Record<string, boolean> = {};
      for (const s of ALL_SCREENS) base[s] = roleDefaults.has(s);
      setToggles(base);
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2000);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to reset permissions');
    } finally {
      setSaving(false);
    }
  };

  const inRole = ALL_SCREENS.filter(s => roleDefaults.has(s));
  const notInRole = ALL_SCREENS.filter(s => !roleDefaults.has(s));

  const ToggleRow: React.FC<{ screen: string }> = ({ screen }) => {
    const isOn = toggles[screen] ?? roleDefaults.has(screen);
    const isDefault = isOn === roleDefaults.has(screen);
    const isAdminLocked = user.role === 'ADMIN' && screen === 'admin';
    return (
      <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-black/5">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-700">{SCREEN_LABELS[screen] ?? screen}</span>
          {isDefault && (
            <span className="text-[9px] font-bold text-slate-400 border border-slate-200 rounded-full px-1.5 py-0.5">Default</span>
          )}
          {isAdminLocked && (
            <span className="text-[9px] font-bold text-amber-600 border border-amber-200 rounded-full px-1.5 py-0.5">Locked</span>
          )}
        </div>
        <button
          type="button"
          disabled={isAdminLocked || saving}
          onClick={() => !isAdminLocked && setToggles(prev => ({ ...prev, [screen]: !prev[screen] }))}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${isOn ? 'bg-[#0078C1]' : 'bg-slate-300'} ${isAdminLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          aria-label={`Toggle ${SCREEN_LABELS[screen]}`}
        >
          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${isOn ? 'translate-x-4' : 'translate-x-0.5'}`} />
        </button>
      </div>
    );
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4 text-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#0078C1]" />
          <h4 className="text-sm font-bold text-slate-800">
            Module Access — {user.name} <span className="text-slate-400 font-normal">({ROLE_LABELS[user.role] ?? user.role})</span>
          </h4>
        </div>
        <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-slate-400 gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading permissions…
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Default for role */}
          <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-3 space-y-0.5">
            <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-2">Default for role</p>
            {inRole.map(s => <ToggleRow key={s} screen={s} />)}
          </div>
          {/* Not in role */}
          <div className="bg-slate-100/60 border border-slate-200 rounded-xl p-3 space-y-0.5">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Not in role</p>
            {notInRole.map(s => <ToggleRow key={s} screen={s} />)}
          </div>
        </div>
      )}

      {error && (
        <p className="text-red-600 text-[11px] font-semibold bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200">
        <button
          onClick={handleSave} disabled={saving || loading}
          className="px-4 py-2 bg-[#0078C1] hover:bg-[#1F3864] text-white font-bold rounded-lg text-[11px] uppercase flex items-center gap-1.5 disabled:opacity-60 cursor-pointer"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : savedOk ? <Check className="w-3 h-3" /> : <Check className="w-3 h-3" />}
          {savedOk ? 'Saved!' : 'Save Changes'}
        </button>
        <button
          onClick={handleReset} disabled={saving || loading}
          className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg text-[11px] uppercase flex items-center gap-1.5 disabled:opacity-60 cursor-pointer"
        >
          <RotateCcw className="w-3 h-3" /> Reset to Role Default
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 text-slate-500 hover:text-slate-700 font-bold text-[11px] uppercase cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function AdminPanel() {
  const [tab, setTab] = useState<Tab>('users');

  // ── User Management ──────────────────────────────────────────────────────────
  const [users, setUsers] = useState<ApiUserAdmin[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '', role: 'SALES_COORDINATOR' });
  const [createError, setCreateError] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [openPermissionsUserId, setOpenPermissionsUserId] = useState<string | null>(null);

  const loadUsers = async () => {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const list = await api.getUsers();
      setUsers(list);
    } catch (err) {
      setUsersError(err instanceof ApiError ? err.message : 'Failed to load users');
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => { if (tab === 'users') loadUsers(); }, [tab]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    if (!createForm.name || !createForm.email || !createForm.password) {
      setCreateError('All fields are required');
      return;
    }
    setCreateLoading(true);
    try {
      const created = await api.createUser(createForm);
      setUsers(prev => [...prev, created]);
      setCreateForm({ name: '', email: '', password: '', role: 'SALES_COORDINATOR' });
      setShowCreateForm(false);
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : 'Failed to create user');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDeactivate = async (user: ApiUserAdmin) => {
    if (!window.confirm(`Deactivate ${user.name} (${user.email})? They will no longer be able to log in.`)) return;
    setDeactivatingId(user.id);
    try {
      const updated = await api.deactivateUser(user.id);
      setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Failed to deactivate user');
    } finally {
      setDeactivatingId(null);
    }
  };

  const handleActivate = async (user: ApiUserAdmin) => {
    if (!window.confirm(`Reactivate ${user.name} (${user.email})? They will be able to log in again.`)) return;
    setActivatingId(user.id);
    try {
      const updated = await api.activateUser(user.id);
      setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Failed to activate user');
    } finally {
      setActivatingId(null);
    }
  };

  // ── Audit Log ────────────────────────────────────────────────────────────────
  const [auditPage, setAuditPage] = useState(1);
  const [auditAction, setAuditAction] = useState('');
  const [auditFrom, setAuditFrom] = useState('');
  const [auditTo, setAuditTo] = useState('');
  const [auditEntries, setAuditEntries] = useState<ApiAdminAuditEntry[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPages, setAuditPages] = useState(1);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  const loadAudit = async (page: number) => {
    setAuditLoading(true);
    setAuditError(null);
    try {
      const result = await api.getAuditLog({
        page,
        limit: 50,
        action: auditAction || undefined,
        from: auditFrom || undefined,
        to: auditTo || undefined
      });
      setAuditEntries(result.entries);
      setAuditTotal(result.total);
      setAuditPages(result.pages);
      setAuditPage(result.page);
    } catch (err) {
      setAuditError(err instanceof ApiError ? err.message : 'Failed to load audit log');
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => { if (tab === 'audit') loadAudit(1); }, [tab]);

  const actionBadge = (action: string) => {
    if (action === 'CREATE') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (action === 'DELETE') return 'bg-red-50 text-red-700 border-red-200';
    return 'bg-blue-50 text-blue-700 border-blue-200';
  };

  const tabClass = (t: Tab) =>
    `px-5 py-2 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border-b-2 ${
      tab === t
        ? 'border-[#0078C1] text-[#0078C1]'
        : 'border-transparent text-slate-500 hover:text-slate-700'
    }`;

  return (
    <div className="space-y-6" id="admin-panel">
      <div className="border-b border-slate-200 pb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            Admin Panel
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">User management and system audit log.</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-slate-200 -mt-2">
        <button className={tabClass('users')} onClick={() => setTab('users')}>
          <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> User Management</span>
        </button>
        <button className={tabClass('audit')} onClick={() => setTab('audit')}>
          <span className="flex items-center gap-1.5"><ClipboardList className="w-3.5 h-3.5" /> System Audit Log</span>
        </button>
      </div>

      {/* ── Tab 1: User Management ── */}
      {tab === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500 font-semibold">{users.length} registered account{users.length !== 1 ? 's' : ''}</p>
            <button
              onClick={() => setShowCreateForm(v => !v)}
              className="bg-[#1F3864] hover:bg-blue-900 text-white text-[11px] font-bold uppercase tracking-wider px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Create User
            </button>
          </div>

          {/* Create user form */}
          {showCreateForm && (
            <form onSubmit={handleCreateUser} className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4 text-xs">
              <h4 className="text-sm font-bold text-slate-800">New User Account</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Full Name</label>
                  <input
                    type="text" required value={createForm.name}
                    onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g., Maria Santos"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Email</label>
                  <input
                    type="email" required value={createForm.email}
                    onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="user@microgenesis.com"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Password</label>
                  <input
                    type="password" required value={createForm.password}
                    onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Role</label>
                  <select
                    value={createForm.role}
                    onChange={e => setCreateForm(f => ({ ...f, role: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none"
                  >
                    {ROLE_OPTIONS.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                </div>
              </div>
              {createError && (
                <p className="text-red-600 text-[11px] font-semibold bg-red-50 border border-red-200 rounded px-3 py-2">{createError}</p>
              )}
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg text-[11px] uppercase cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={createLoading}
                  className="px-5 py-2 bg-[#0078C1] hover:bg-[#1F3864] text-white font-bold rounded-lg text-[11px] uppercase flex items-center gap-1.5 disabled:opacity-60 cursor-pointer">
                  {createLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Create
                </button>
              </div>
            </form>
          )}

          {usersError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg px-4 py-3">{usersError}</div>
          )}

          {usersLoading ? (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading users...
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No users found.</td></tr>
                  ) : users.map(u => (
                    <React.Fragment key={u.id}>
                      <tr className="hover:bg-slate-50 transition-all">
                        <td className="px-4 py-3 font-bold text-slate-900">{u.name}</td>
                        <td className="px-4 py-3 text-slate-600 font-mono text-[10px]">{u.email}</td>
                        <td className="px-4 py-3">
                          <span className="bg-blue-50 text-blue-700 border border-blue-100 text-[10px] px-2 py-0.5 rounded-full font-semibold">
                            {ROLE_LABELS[u.role] ?? u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {u.is_active
                            ? <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] px-2 py-0.5 rounded-full font-semibold">Active</span>
                            : <span className="bg-slate-100 text-slate-500 border border-slate-200 text-[10px] px-2 py-0.5 rounded-full font-semibold">Deactivated</span>
                          }
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => setOpenPermissionsUserId(prev => prev === u.id ? null : u.id)}
                              className={`flex items-center gap-1 font-bold text-[10px] uppercase tracking-wide cursor-pointer ${openPermissionsUserId === u.id ? 'text-[#0078C1]' : 'text-slate-500 hover:text-[#0078C1]'}`}
                            >
                              <ShieldCheck className="w-3 h-3" /> Manage Access
                            </button>
                            {u.is_active ? (
                              <button
                                onClick={() => handleDeactivate(u)}
                                disabled={deactivatingId === u.id}
                                className="flex items-center gap-1 text-red-600 hover:text-red-800 font-bold text-[10px] uppercase tracking-wide disabled:opacity-50 cursor-pointer"
                              >
                                {deactivatingId === u.id
                                  ? <Loader2 className="w-3 h-3 animate-spin" />
                                  : <UserX className="w-3 h-3" />
                                }
                                Deactivate
                              </button>
                            ) : (
                              <button
                                onClick={() => handleActivate(u)}
                                disabled={activatingId === u.id}
                                className="flex items-center gap-1 text-emerald-600 hover:text-emerald-800 font-bold text-[10px] uppercase tracking-wide disabled:opacity-50 cursor-pointer"
                              >
                                {activatingId === u.id
                                  ? <Loader2 className="w-3 h-3 animate-spin" />
                                  : <Check className="w-3 h-3" />
                                }
                                Activate
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {openPermissionsUserId === u.id && (
                        <tr>
                          <td colSpan={5} className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                            <PermissionsPanel
                              user={u}
                              onClose={() => setOpenPermissionsUserId(null)}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab 2: System Audit Log ── */}
      {tab === 'audit' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-wrap gap-3 items-end text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-700 block">Action</label>
              <select value={auditAction} onChange={e => setAuditAction(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-xs w-36">
                <option value="">All Actions</option>
                <option value="CREATE">CREATE</option>
                <option value="UPDATE">UPDATE</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-700 block">From</label>
              <input type="date" value={auditFrom} onChange={e => setAuditFrom(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-xs" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-700 block">To</label>
              <input type="date" value={auditTo} onChange={e => setAuditTo(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-xs" />
            </div>
            <button
              onClick={() => loadAudit(1)}
              className="px-4 py-2 bg-[#0078C1] hover:bg-[#1F3864] text-white font-bold text-[11px] uppercase rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              {auditLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Apply Filters
            </button>
          </div>

          {auditError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg px-4 py-3">{auditError}</div>
          )}

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="p-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {auditTotal} total entries
              </span>
              <span className="text-[10px] text-slate-400">Page {auditPage} of {auditPages || 1}</span>
            </div>

            {auditLoading ? (
              <div className="flex items-center justify-center py-12 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading audit log...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      <th className="px-4 py-3">Timestamp</th>
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3 text-center">Action</th>
                      <th className="px-4 py-3">Record ID</th>
                      <th className="px-4 py-3">Record Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditEntries.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No audit entries found.</td></tr>
                    ) : auditEntries.map(e => (
                      <tr key={e.id} className="hover:bg-slate-50 transition-all">
                        <td className="px-4 py-3 font-mono text-[10px] text-slate-500">
                          {new Date(e.timestamp).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-800">{e.changed_by}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold tracking-wide ${actionBadge(e.action)}`}>
                            {e.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-[10px] text-slate-700">{e.record_id}</td>
                        <td className="px-4 py-3 text-slate-600">{e.record_type}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            <div className="p-3 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => { const p = Math.max(1, auditPage - 1); setAuditPage(p); loadAudit(p); }}
                disabled={auditPage <= 1 || auditLoading}
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] rounded-lg disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Previous
              </button>
              <span className="text-[11px] text-slate-400 font-semibold">
                {auditTotal === 0 ? '0 entries' : `${(auditPage - 1) * 50 + 1}–${Math.min(auditPage * 50, auditTotal)} of ${auditTotal}`}
              </span>
              <button
                onClick={() => { const p = Math.min(auditPages, auditPage + 1); setAuditPage(p); loadAudit(p); }}
                disabled={auditPage >= auditPages || auditLoading}
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] rounded-lg disabled:opacity-40 cursor-pointer"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
