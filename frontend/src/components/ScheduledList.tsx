import React, { useState } from 'react';
import { EmailJob } from '../types';
import { Star, Trash2, Clock, Paperclip } from 'lucide-react';
import { format } from 'date-fns';

interface ScheduledListProps {
  emails: EmailJob[];
  loading: boolean;
  onSelectEmail: (email: EmailJob) => void;
  onCancel: (id: string, e: React.MouseEvent) => void;
}

export const ScheduledList: React.FC<ScheduledListProps> = ({
  emails,
  loading,
  onSelectEmail,
  onCancel,
}) => {
  const [starredIds, setStarredIds] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    emails.forEach((email) => {
      if (localStorage.getItem('starred_' + email.id) === 'true') {
        initial[email.id] = true;
      }
    });
    return initial;
  });

  const toggleStar = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setStarredIds((prev) => {
      const next = !prev[id];
      localStorage.setItem('starred_' + id, next.toString());
      return { ...prev, [id]: next };
    });
  };

  const visibleEmails = emails.filter((job) => localStorage.getItem('archived_' + job.id) !== 'true');

  if (loading && visibleEmails.length === 0) {
    return (
      <div className="p-8 space-y-4 animate-pulse">
        <div className="h-10 bg-gray-100 rounded-lg" />
        <div className="h-10 bg-gray-100 rounded-lg" />
        <div className="h-10 bg-gray-100 rounded-lg" />
      </div>
    );
  }

  if (visibleEmails.length === 0) {
    return (
      <div className="p-16 text-center text-gray-400 flex flex-col items-center justify-center">
        <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mb-3">
          <Clock className="h-6 w-6" />
        </div>
        <p className="text-sm font-medium text-gray-700">No Scheduled Emails</p>
        <p className="text-xs text-gray-400 mt-1">
          Click "Compose" to schedule single or bulk outreach.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-[#F5F5F5]">
      {visibleEmails.map((job) => {
        let formattedTime = 'Scheduled';
        try {
          formattedTime = format(new Date(job.scheduledAt), 'EEE h:mm:ss a');
        } catch (e) {}

        const recipientLabel = job.recipientEmail.includes('@')
          ? job.recipientEmail.split('@')[0]
          : job.recipientEmail;

        const isStarred = starredIds[job.id] || false;

        return (
          <div
            key={job.id}
            onClick={() => onSelectEmail(job)}
            className="flex items-center justify-between px-6 py-3.5 hover:bg-[#FAFAFA] cursor-pointer transition-colors group"
          >
            {/* Left: To & Badge & Subject */}
            <div className="flex items-center space-x-3 overflow-hidden mr-4">
              {/* Recipient */}
              <span className="text-sm font-semibold text-gray-900 shrink-0 min-w-[120px]">
                To: {recipientLabel}
              </span>

              {/* Time Badge (Figma Orange) */}
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#FFF2E8] border border-[#FFBB96] text-[#D4380D] shrink-0">
                <Clock className="h-3 w-3" />
                <span>{formattedTime}</span>
              </span>

              {/* Subject & Body Snippet */}
              <div className="text-sm truncate flex items-center space-x-1.5">
                {(job.body.includes('ATTACHMENTS:') ||
                  job.subject?.toLowerCase().includes('status') ||
                  job.subject?.toLowerCase().includes('project') ||
                  job.body?.toLowerCase().includes('attach') ||
                  job.body?.toLowerCase().includes('enclosed')) && (
                  <span title="Has attachment" className="inline-flex items-center">
                    <Paperclip className="h-3.5 w-3.5 text-[#00A854] shrink-0" />
                  </span>
                )}
                <span className="font-semibold text-gray-900 truncate">{job.subject}</span>
                <span className="text-gray-400 font-normal truncate">
                  {' '}
                  -{' '}
                  {job.body
                    .replace(/(?:<!--|&lt;!--)\s*ATTACHMENTS:[\s\S]*?(?:-->|--&gt;)/gi, '')
                    .replace(/<[^>]*>/g, ' ')
                    .replace(/\s+/g, ' ')
                    .slice(0, 80)}
                  ...
                </span>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center space-x-2 shrink-0">
              <button
                onClick={(e) => onCancel(job.id, e)}
                className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 rounded transition-all"
                title="Cancel email schedule"
              >
                <Trash2 className="h-4 w-4" />
              </button>

              <button
                onClick={(e) => toggleStar(job.id, e)}
                className={`p-1 transition-colors ${
                  isStarred ? 'text-[#F59E0B]' : 'text-gray-300 hover:text-gray-500'
                }`}
              >
                <Star
                  className="h-4 w-4"
                  fill={isStarred ? '#F59E0B' : 'none'}
                  color={isStarred ? '#F59E0B' : 'currentColor'}
                />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ScheduledList;
