import React from 'react';
import { SchedulerMetrics } from '../types';
import { Clock, CheckCircle2, AlertTriangle, Layers } from 'lucide-react';

interface MetricsBarProps {
  metrics: SchedulerMetrics | null;
}

export const MetricsBar: React.FC<MetricsBarProps> = ({ metrics }) => {
  const scheduledCount = metrics?.stats.scheduled ?? 0;
  const sentCount = metrics?.stats.sent ?? 0;
  const rateLimitedCount = metrics?.stats.rateLimited ?? 0;
  const queueDepth = (metrics?.queue.waiting ?? 0) + (metrics?.queue.delayed ?? 0);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {/* Scheduled */}
      <div className="bg-[#12161F] border border-[#1F2430] p-4 rounded-xl flex items-center space-x-3">
        <div className="h-10 w-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
          <Clock className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-gray-400 font-medium">Scheduled</p>
          <p className="text-xl font-bold text-white tracking-tight">{scheduledCount}</p>
        </div>
      </div>

      {/* Sent */}
      <div className="bg-[#12161F] border border-[#1F2430] p-4 rounded-xl flex items-center space-x-3">
        <div className="h-10 w-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-gray-400 font-medium">Delivered (Ethereal)</p>
          <p className="text-xl font-bold text-white tracking-tight">{sentCount}</p>
        </div>
      </div>

      {/* Rate Limited */}
      <div className="bg-[#12161F] border border-[#1F2430] p-4 rounded-xl flex items-center space-x-3">
        <div className="h-10 w-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-gray-400 font-medium">Rate-Limited & Delayed</p>
          <p className="text-xl font-bold text-amber-300 tracking-tight">{rateLimitedCount}</p>
        </div>
      </div>

      {/* Queue Depth */}
      <div className="bg-[#12161F] border border-[#1F2430] p-4 rounded-xl flex items-center space-x-3">
        <div className="h-10 w-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
          <Layers className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-gray-400 font-medium">BullMQ Active Depth</p>
          <p className="text-xl font-bold text-purple-300 tracking-tight">{queueDepth}</p>
        </div>
      </div>
    </div>
  );
};

export default MetricsBar;
