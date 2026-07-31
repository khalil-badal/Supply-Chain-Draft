import {
  Banknote,
  ShieldCheck,
  Clock,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  RotateCw
} from 'lucide-react';
import { DeliveryRecord } from '../types';
import { ApiDashboardStats } from '../api';

interface Props {
  stats: Extract<ApiDashboardStats, { role: 'TASS' }> | null;
  deliveryRecords: DeliveryRecord[];
  onNavigate: (screen: string, item_id?: string) => void;
  onRefresh?: () => void;
}

function daysSince(dateStr: string): number {
  const then = new Date(dateStr).getTime();
  const now = Date.now();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

export default function TassDashboard({ stats, deliveryRecords, onNavigate, onRefresh }: Props) {
  const today = new Date().toISOString().split('T')[0];

  // deliveryRecords for TASS only contains ACCOUNTING_COLLECTION records (API-filtered)
  const unverifiedRecords = deliveryRecords
    .filter(r => r.status === 'Delivered' && !r.collection_verified)
    .sort((a, b) => new Date(a.delivery_date).getTime() - new Date(b.delivery_date).getTime());

  const collectionsThisMonth = stats?.collections_this_month
    ?? (() => {
      const monthStr = today.slice(0, 7);
      return deliveryRecords.filter(r => r.created_at?.slice(0, 7) === monthStr).length;
    })();

  const pendingVerification = stats?.pending_verification ?? unverifiedRecords.length;

  const verifiedToday = stats?.verified_today
    ?? deliveryRecords.filter(r => r.collection_verified && r.collection_verified_at?.slice(0, 10) === today).length;

  const overdueUnverified = stats?.overdue_unverified
    ?? unverifiedRecords.filter(r => daysSince(r.modified_at) > 2).length;

  // Peso totals
  const totalUnverifiedAmount = unverifiedRecords.reduce((sum, r) => sum + (r.amount ?? 0), 0);
  const totalVerifiedTodayAmount = deliveryRecords
    .filter(r => r.collection_verified && r.collection_verified_at?.slice(0, 10) === today)
    .reduce((sum, r) => sum + (r.amount ?? 0), 0);

  const fmtPeso = (n: number) => n > 0 ? `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : null;

  return (
    <div className="space-y-6" id="tass-dashboard">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#1F3864] to-[#122B4F] text-white p-6 rounded-xl shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 border-l-8 border-l-emerald-500">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-emerald-600 text-white font-extrabold px-2 py-0.5 rounded tracking-widest uppercase">TASS</span>
            <span className="text-sm text-slate-200 font-bold tracking-wider uppercase">Collection Verification</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight mt-1">Accounting Collections Console</h1>
          <p className="text-slate-300 text-sm mt-1 font-medium">
            Track and verify billing statement and payment collection runs.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-md px-3 py-1.5 text-white text-sm">
          <Banknote className="w-4 h-4 text-emerald-400" />
          <span>Role: <span className="text-emerald-400 font-extrabold uppercase">TASS</span></span>
        </div>
        {onRefresh && (
          <button onClick={onRefresh} className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-md px-3 py-1.5 text-white text-sm transition-colors cursor-pointer">
            <RotateCw className="w-3.5 h-3.5" /> Refresh
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Collections This Month */}
        <div
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between gap-3 hover:border-[#1F3864] transition-all cursor-pointer"
          onClick={() => onNavigate('accounting_collection')}
        >
          <div className="min-w-0">
            <p className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Collections This Month</p>
            <h3 className="text-3xl font-black text-slate-900 mt-1">{collectionsThisMonth}</h3>
            <span className="text-xs text-slate-600 font-extrabold flex items-center gap-1 mt-2">
              View all <ArrowRight className="w-3.5 h-3.5 shrink-0" />
            </span>
          </div>
          <div className="bg-emerald-50 p-3 rounded-lg text-emerald-700 shrink-0"><Banknote className="w-6 h-6" /></div>
        </div>

        {/* Pending Verification (orange) */}
        <div
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-amber-500 flex items-center justify-between gap-3 hover:border-amber-400 transition-all cursor-pointer"
          onClick={() => onNavigate('accounting_collection')}
        >
          <div className="min-w-0">
            <p className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Pending Verification</p>
            <h3 className="text-3xl font-black text-slate-900 mt-1">{pendingVerification}</h3>
            {fmtPeso(totalUnverifiedAmount) && (
              <p className="text-xs font-black text-amber-700 mt-0.5 tabular-nums leading-tight">
                {fmtPeso(totalUnverifiedAmount)}{' '}
                <span className="font-normal text-slate-400">across {pendingVerification} record{pendingVerification !== 1 ? 's' : ''}</span>
              </p>
            )}
            <span className="text-xs text-amber-600 font-extrabold flex items-center gap-1 mt-1">
              Awaiting TASS sign-off <Clock className="w-3.5 h-3.5 shrink-0" />
            </span>
          </div>
          <div className={`p-3 rounded-lg shrink-0 ${pendingVerification > 0 ? 'bg-amber-50 text-amber-600 animate-pulse' : 'bg-gray-50 text-gray-400'}`}>
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Verified Today */}
        <div
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-emerald-500 flex items-center justify-between gap-3 hover:border-emerald-400 transition-all cursor-pointer"
          onClick={() => onNavigate('accounting_collection')}
        >
          <div className="min-w-0">
            <p className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Verified Today</p>
            <h3 className="text-3xl font-black text-slate-900 mt-1">{verifiedToday}</h3>
            {fmtPeso(totalVerifiedTodayAmount) && (
              <p className="text-sm font-black text-emerald-700 mt-0.5 tabular-nums">{fmtPeso(totalVerifiedTodayAmount)}</p>
            )}
            <span className="text-xs text-emerald-600 font-extrabold flex items-center gap-1 mt-1">
              Confirmed <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            </span>
          </div>
          <div className="bg-emerald-50 p-3 rounded-lg text-emerald-600 shrink-0"><CheckCircle2 className="w-6 h-6" /></div>
        </div>

        {/* Overdue Unverified (red) */}
        <div
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-red-500 flex items-center justify-between gap-3 hover:border-red-400 transition-all cursor-pointer"
          onClick={() => onNavigate('accounting_collection')}
        >
          <div className="min-w-0">
            <p className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Overdue Unverified</p>
            <h3 className="text-3xl font-black text-slate-900 mt-1">{overdueUnverified}</h3>
            <span className="text-xs text-red-600 font-extrabold flex items-center gap-1 mt-2">
              Over 2 days unverified <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            </span>
          </div>
          <div className={`p-3 rounded-lg shrink-0 ${overdueUnverified > 0 ? 'bg-red-50 text-red-600 animate-pulse' : 'bg-gray-50 text-gray-400'}`}>
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Needs Attention: Unverified Records */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> Unverified Collections — Needs Attention
          </h4>
          <span className={`text-xs px-2.5 py-0.5 rounded font-extrabold uppercase tracking-wide ${
            unverifiedRecords.length > 0
              ? 'bg-amber-100 text-amber-800'
              : 'bg-emerald-100 text-emerald-800'
          }`}>
            {unverifiedRecords.length} pending
          </span>
        </div>

        {unverifiedRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <ShieldCheck className="w-10 h-10 text-emerald-500 mb-2" />
            <p className="text-base font-bold text-slate-700">All collections verified</p>
            <p className="text-xs text-slate-400">No accomplished collections are awaiting your verification.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <th className="px-4 py-3">Record ID</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3 text-center">Delivery Date</th>
                  <th className="px-4 py-3 text-center">Days Since Accomplished</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {unverifiedRecords.map(r => {
                  const days = daysSince(r.modified_at);
                  const isOverdue = days > 2;
                  return (
                    <tr
                      key={r.id}
                      className="hover:bg-amber-50/40 cursor-pointer transition-all"
                      onClick={() => onNavigate('accounting_collection', r.id)}
                    >
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">{r.id}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800 max-w-[180px] truncate">{r.company_name}</td>
                      <td className="px-4 py-3 font-mono text-slate-500 text-[10px]">{r.reference}</td>
                      <td className="px-4 py-3 text-center text-slate-600 font-semibold">{r.delivery_date}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-black text-sm ${isOverdue ? 'text-red-600' : 'text-amber-600'}`}>
                          {days === 0 ? 'Today' : `${days}d`}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isOverdue ? (
                          <span className="bg-red-50 text-red-700 border border-red-200 text-[10px] font-bold px-2 py-0.5 rounded-full">Overdue</span>
                        ) : (
                          <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-full">Pending</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          className="text-[#0078C1] hover:underline text-[10px] font-bold uppercase tracking-wide cursor-pointer"
                          onClick={e => { e.stopPropagation(); onNavigate('accounting_collection', r.id); }}
                        >
                          Verify →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
