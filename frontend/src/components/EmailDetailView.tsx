import React from 'react';
import { EmailJob } from '../types';
import { ArrowLeft, Star, Trash2, Archive, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

interface EmailDetailViewProps {
  email: EmailJob;
  onBack: () => void;
  onDelete?: (id: string) => void;
}

export const EmailDetailView: React.FC<EmailDetailViewProps> = ({
  email,
  onBack,
  onDelete,
}) => {
  let formattedDate = 'Recently';
  if (email.sentAt) {
    try {
      formattedDate = format(new Date(email.sentAt), 'MMM d, h:mm a');
    } catch (e) {}
  } else if (email.scheduledAt) {
    try {
      formattedDate = format(new Date(email.scheduledAt), 'MMM d, h:mm a (Scheduled)');
    } catch (e) {}
  }

  const senderInitial = email.senderEmail ? email.senderEmail.charAt(0).toUpperCase() : 'S';

  return (
    <div className="flex-1 flex flex-col h-full bg-white overflow-y-auto">
      {/* Top Bar (Figma Match) */}
      <div className="h-16 px-6 border-b border-[#F0F0F0] flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-4 overflow-hidden mr-4">
          <button
            onClick={onBack}
            className="p-1.5 text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
            title="Back to list"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-base font-bold text-gray-900 truncate">
            {email.subject}
          </h2>
        </div>

        {/* Right Action Icons */}
        <div className="flex items-center space-x-3 text-gray-400">
          {email.etherealPreviewUrl && (
            <a
              href={email.etherealPreviewUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#00A854] bg-[#E6F4EA] hover:bg-[#d8f0de] transition-colors"
            >
              <span>Inspect on Ethereal</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          <button className="p-1.5 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
            <Star className="h-4 w-4" />
          </button>
          <button className="p-1.5 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
            <Archive className="h-4 w-4" />
          </button>
          {onDelete && (
            <button
              onClick={() => onDelete(email.id)}
              className="p-1.5 hover:text-red-500 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Reading Area */}
      <div className="p-8 max-w-4xl space-y-6">
        {/* Sender Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            {/* Green Initial Avatar */}
            <div className="h-10 w-10 rounded-full bg-[#00A854] text-white flex items-center justify-center font-bold text-base shrink-0">
              {senderInitial}
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-sm text-gray-900">
                  {email.senderEmail.split('@')[0]}
                </span>
                <span className="text-xs text-gray-400">&lt;{email.senderEmail}&gt;</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                to {email.recipientEmail}
              </p>
            </div>
          </div>

          <span className="text-xs text-gray-400 font-medium">
            {formattedDate}
          </span>
        </div>

        {/* Email Body Content */}
        <div className="text-sm text-gray-800 leading-relaxed pt-2">
          {email.body.includes('<') ? (
            <div
              className="rich-editor-content leading-relaxed space-y-2"
              dangerouslySetInnerHTML={{ __html: email.body }}
            />
          ) : (
            <div className="space-y-4">
              {email.body.split('\n').map((paragraph, idx) => (
                <p key={idx}>{paragraph}</p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailDetailView;
