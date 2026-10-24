import React, { useState } from 'react';
import { EmailJob } from '../types';
import { Star, ExternalLink, CheckCircle2, Paperclip } from 'lucide-react';

interface SentListProps {
  emails: EmailJob[];
  loading: boolean;
  onSelectEmail: (email: EmailJob) => void;
}

export const SentList: React.FC<SentListProps> = ({
  emails,
  loading,
  onSelectEmail,
}) => {
  const [starredIds, setStarredIds] = useState<Record<string, boolean>>({});

  const toggleStar = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setStarredIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading && emails.length === 0) {
    return (
      <div className="p-8 space-y-4 animate-pulse">
        <div className="h-10 bg-gray-100 rounded-lg" />
        <div className="h-10 bg-gray-100 rounded-lg" />
        <div className="h-10 bg-gray-100 rounded-lg" />
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="p-16 text-center text-gray-400 flex flex-col items-center justify-center">
        <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mb-3">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <p className="text-sm font-medium text-gray-700">No Sent Emails Yet</p>
        <p className="text-xs text-gray-400 mt-1">
          Delivered emails will automatically appear here once their scheduled run time arrives.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-[#F5F5F5]">
      {emails.map((job) => {
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

              {/* Sent Badge (Figma Gray) */}
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F3F4F6] text-[#595959] shrink-0">
                Sent
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

            {/* Right: Ethereal Link & Star */}
            <div className="flex items-center space-x-2 shrink-0">
              {job.etherealPreviewUrl && (
                <a
                  href={job.etherealPreviewUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-medium text-[#00A854] bg-[#E6F4EA] hover:bg-[#d8f0de] transition-colors"
                >
                  <span>View Mail</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}

              <button
                onClick={(e) => toggleStar(job.id, e)}
                className={`p-1 transition-colors ${
                  isStarred ? 'text-amber-400 fill-amber-400' : 'text-gray-300 hover:text-gray-500'
                }`}
              >
                <Star className={`h-4 w-4 ${isStarred ? 'fill-amber-400' : ''}`} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SentList;
