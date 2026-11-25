import { AlertTriangle, CheckCircle2, Clock, Wrench, XCircle } from 'lucide-react';
import { ResourceStatus } from '../types/campus';

interface StatusLabelProps {
  status: ResourceStatus | 'Active' | 'Partially Mitigated' | 'Resolved' | 'Nominal' | 'Degraded' | 'Critical' | 'Feasible' | 'Not Feasible';
}

export function StatusLabel({ status }: StatusLabelProps) {
  if (status === 'Operational' || status === 'Resolved' || status === 'Nominal' || status === 'Feasible') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>{status}</span>
      </span>
    );
  }

  if (status === 'Maintenance' || status === 'Partially Mitigated' || status === 'Degraded') {
    const Icon = status === 'Maintenance' ? Wrench : Clock;
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400 whitespace-nowrap">
        <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>{status}</span>
      </span>
    );
  }

  const Icon = status === 'Not Feasible' ? XCircle : AlertTriangle;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-400 whitespace-nowrap">
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{status}</span>
    </span>
  );
}
