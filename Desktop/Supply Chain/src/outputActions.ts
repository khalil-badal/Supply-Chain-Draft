import { DeliveryCategory, DeliveryStatus, OutputActionConfig, OutputActionLogEntry, OutputActionTrigger } from './types';

export const OUTPUT_ACTION_TRIGGERS: OutputActionTrigger[] = [
  'Record Created',
  'Accomplished',
  'Rescheduled',
  'On-Hold',
  'RMA Completed',
  'Collection Verified'
];

// Per-trigger defaults. Configurable at runtime via the Output Actions panel;
// these are just the starting state.
export const DEFAULT_OUTPUT_ACTIONS: Record<OutputActionTrigger, OutputActionConfig> = {
  'Record Created': { notifyAM: false, notifyLogistics: true, notifyTASS: false, exportPDF: false, internalOnly: false },
  'Accomplished': { notifyAM: true, notifyLogistics: false, notifyTASS: false, exportPDF: false, internalOnly: false },
  'Rescheduled': { notifyAM: true, notifyLogistics: true, notifyTASS: false, exportPDF: false, internalOnly: false },
  'On-Hold': { notifyAM: true, notifyLogistics: true, notifyTASS: false, exportPDF: false, internalOnly: false },
  'RMA Completed': { notifyAM: true, notifyLogistics: false, notifyTASS: true, exportPDF: true, internalOnly: false },
  'Collection Verified': { notifyAM: true, notifyLogistics: false, notifyTASS: true, exportPDF: true, internalOnly: false }
};

// Maps a status change to the IPO trigger it represents, if any. Scheduled/Pending
// are not process-output events under this framework.
export function getOutputTrigger(category: DeliveryCategory, status: DeliveryStatus): OutputActionTrigger | null {
  if (status === 'Delivered') {
    if (category === 'RMA') return 'RMA Completed';
    if (category === 'Accounting Collection') return 'Collection Verified';
    return 'Accomplished';
  }
  if (status === 'Rescheduled') return 'Rescheduled';
  if (status === 'On-Hold') return 'On-Hold';
  return null;
}

export interface OutputActionResult {
  newEntries: OutputActionLogEntry[];
  banners: string[];
  emailSent: boolean;
}

// Runs the configured output actions for a trigger and produces both the
// persisted log entries (for the audit-style trail) and the banner text to
// show immediately. Nothing here calls a real backend - it's a prototype
// simulation of what would leave the system.
export function runOutputActions(
  trigger: OutputActionTrigger,
  config: OutputActionConfig,
  ctx: { amName: string; at?: string }
): OutputActionResult {
  const at = ctx.at ?? new Date().toISOString();
  const banners: string[] = [];
  const messages: string[] = [];

  if (config.internalOnly) {
    messages.push('Kept internal only — no external notifications sent.');
  } else {
    if (config.notifyAM) {
      banners.push(`Email sent to: ${ctx.amName}`);
      messages.push(`Notified Account Manager (${ctx.amName}) by email`);
    }
    if (config.notifyLogistics) {
      banners.push('Logistics notified');
      messages.push('Notified Logistics');
    }
    if (config.notifyTASS) {
      banners.push('TASS notified');
      messages.push('Notified TASS');
    }
    if (config.exportPDF) {
      banners.push('Exported to PDF');
      messages.push('Exported record to PDF (mock — no file generated)');
    }
    if (!config.notifyAM && !config.notifyLogistics && !config.notifyTASS && !config.exportPDF) {
      messages.push('No output actions selected — nothing sent.');
    }
  }

  return {
    newEntries: messages.map(message => ({ trigger, message, at })),
    banners,
    emailSent: config.notifyAM && !config.internalOnly
  };
}
