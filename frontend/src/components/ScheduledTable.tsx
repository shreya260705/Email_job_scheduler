import React from 'react';
import { EmailJob } from '../types';
import { Clock, Trash2, AlertCircle, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

interface ScheduledTableProps {
  emails: EmailJob[];
  loading: boolean;
  onCancel: (id: string) => void;
  onRefresh: () => void;
}

export const ScheduledTable: React.FC<ScheduledTableProps> = ({
  emails,
  loading,
  onCancel,
  onRefresh,
}) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SCHEDULED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
            Scheduled
          </span>
        );
      case 'RATE_LIMITED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30">
            Rate-Limited (Postponed)
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
            In Flight
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/10 text-gray-400">
            {status}
          </span>
        );
    }
  };

  if (loading && emails.length === 0) {
    return (
      <div className="p-8 text-center bg-[#12161F] border border-[#1F2430] rounded-xl space-y-3 animate-pulse">
        <div className="h-4 bg-gray-800 rounded w-1/4 mx-auto" />
        <div className="h-4 bg-gray-800 rounded w-1/2 mx-auto" />
        <div className="h-4 bg-gray-800 rounded w-1/3 mx-auto" />
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="p-12 text-center bg-[#12161F] border border-[#1F2430] rounded-2xl flex flex-col items-center justify-center">
        <div className="h-12 w-12 rounded-xl bg-gray-800 flex items-center justify-center text-gray-500 mb-3">
          <Clock className="h-6 w-6" />
        </div>
        <h3 className="text-sm font-semibold text-white">No Scheduled Emails</h3>
        <p className="text-xs text-gray-400 max-w-sm mt-1">
          You don't have any emails queued up. Click "Compose Email" above to schedule single or bulk outreach.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[#12161F] border border-[#1F2430] rounded-2xl overflow-hidden shadow-xl">
      <div className="px-6 py-3 border-b border-[#1F2430] flex items-center justify-between bg-[#151A24]">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          {emails.length} Queued Dispatch{emails.length > 1 ? 'es' : ''}
        </span>
        <button
          onClick={onRefresh}
          className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-800 transition-colors"
          title="Refresh table"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#1F2430] text-[11px] font-semibold text-gray-400 uppercase tracking-wider bg-[#0E121A]">
              <th className="py-3 px-6">Recipient</th>
              <th className="py-3 px-6">Subject</th>
              <th className="py-3 px-6">Sender</th>
              <th className="py-3 px-6">Scheduled Run Time</th>
              <th className="py-3 px-6">Status</th>
              <th className="py-3 px-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1F2430]">
            {emails.map((job) => {
              let scheduledFormatted = 'Invalid Date';
              try {
                scheduledFormatted = format(new Date(job.scheduledAt), 'MMM d, yyyy h:mm:ss a');
              } catch (e) {}

              return (
                <tr key={job.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3.5 px-6 font-medium text-white">{job.recipientEmail}</td>
                  <td className="py-3.5 px-6 text-gray-300 max-w-[200px] truncate">{job.subject}</td>
                  <td className="py-3.5 px-6 text-xs text-gray-400 font-mono">{job.senderEmail}</td>
                  <td className="py-3.5 px-6 text-xs text-gray-300">
                    <div className="flex items-center space-x-1.5">
                      <Clock className="h-3.5 w-3.5 text-gray-500" />
                      <span>{scheduledFormatted}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-6">{getStatusBadge(job.status)}</td>
                  <td className="py-3.5 px-6 text-right">
                    <button
                      onClick={() => onCancel(job.id)}
                      className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Cancel email schedule"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ScheduledTable;
