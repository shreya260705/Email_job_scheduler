import React from 'react';
import { EmailJob } from '../types';
import { CheckCircle2, XCircle, ExternalLink, RefreshCw, Send } from 'lucide-react';
import { format } from 'date-fns';

interface SentTableProps {
  emails: EmailJob[];
  loading: boolean;
  onRefresh: () => void;
}

export const SentTable: React.FC<SentTableProps> = ({
  emails,
  loading,
  onRefresh,
}) => {
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
          <Send className="h-6 w-6" />
        </div>
        <h3 className="text-sm font-semibold text-white">No Emails Sent Yet</h3>
        <p className="text-xs text-gray-400 max-w-sm mt-1">
          When queued jobs reach their target schedule, sent results and Ethereal preview links will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[#12161F] border border-[#1F2430] rounded-2xl overflow-hidden shadow-xl">
      <div className="px-6 py-3 border-b border-[#1F2430] flex items-center justify-between bg-[#151A24]">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          {emails.length} Dispatched Result{emails.length > 1 ? 's' : ''}
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
              <th className="py-3 px-6">Delivered At</th>
              <th className="py-3 px-6">Delivery Status</th>
              <th className="py-3 px-6 text-right">Ethereal Preview</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1F2430]">
            {emails.map((job) => {
              let sentFormatted = '-';
              if (job.sentAt) {
                try {
                  sentFormatted = format(new Date(job.sentAt), 'MMM d, h:mm:ss a');
                } catch (e) {}
              }

              const isSuccess = job.status === 'SENT';

              return (
                <tr key={job.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3.5 px-6 font-medium text-white">{job.recipientEmail}</td>
                  <td className="py-3.5 px-6 text-gray-300 max-w-[200px] truncate">{job.subject}</td>
                  <td className="py-3.5 px-6 text-xs text-gray-400 font-mono">{job.senderEmail}</td>
                  <td className="py-3.5 px-6 text-xs text-gray-300">{sentFormatted}</td>
                  <td className="py-3.5 px-6">
                    {isSuccess ? (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Sent</span>
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20"
                        title={job.failureReason || 'Failed'}
                      >
                        <XCircle className="h-3 w-3" />
                        <span>Failed</span>
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-6 text-right">
                    {job.etherealPreviewUrl ? (
                      <a
                        href={job.etherealPreviewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 transition-colors"
                      >
                        <span>View Mail</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-xs text-gray-600">-</span>
                    )}
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

export default SentTable;
