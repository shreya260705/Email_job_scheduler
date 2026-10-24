import React from 'react';
import { EmailJob } from '../types';
import { ArrowLeft, Star, Trash2, Archive, ExternalLink, Paperclip, Download } from 'lucide-react';
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

  // Extract attachments from HTML comment if present
  let cleanBody = email.body;
  let parsedAttachments: Array<{ name: string; size: number; type: string }> = [];

  const attachmentMatch = email.body.match(/<!--ATTACHMENTS:(.*?)-->/);
  if (attachmentMatch && attachmentMatch[1]) {
    try {
      parsedAttachments = JSON.parse(attachmentMatch[1]);
      cleanBody = email.body.replace(/<!--ATTACHMENTS:(.*?)-->/g, '').trim();
    } catch (e) {}
  }

  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const getFileExtension = (filename: string): string => {
    const ext = filename.split('.').pop() || 'FILE';
    return ext.toUpperCase().slice(0, 4);
  };

  const getFileBadgeStyle = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'csv':
      case 'xls':
      case 'xlsx':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'pdf':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'txt':
      case 'doc':
      case 'docx':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'svg':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const handleDownload = (att: { name: string; size: number; type: string }) => {
    const blob = new Blob(
      [`Attachment: ${att.name}\nSize: ${att.size} bytes\nEmail Subject: ${email.subject}\nRecipient: ${email.recipientEmail}`],
      { type: 'text/plain' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = att.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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
          {cleanBody.includes('<') ? (
            <div
              className="rich-editor-content leading-relaxed space-y-2"
              dangerouslySetInnerHTML={{ __html: cleanBody }}
            />
          ) : (
            <div className="space-y-4">
              {cleanBody.split('\n').map((paragraph, idx) => (
                <p key={idx}>{paragraph}</p>
              ))}
            </div>
          )}
        </div>

        {/* Gmail-style Attachments Container in Email Detail */}
        {parsedAttachments.length > 0 && (
          <div className="pt-6 border-t border-gray-100 space-y-3">
            <div className="flex items-center space-x-2 text-xs text-gray-500 font-semibold uppercase tracking-wider">
              <Paperclip className="h-4 w-4 text-[#00A854]" />
              <span>
                {parsedAttachments.length} Attachment{parsedAttachments.length > 1 ? 's' : ''}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {parsedAttachments.map((att, idx) => (
                <div
                  key={idx}
                  onClick={() => handleDownload(att)}
                  className="flex items-center justify-between p-3 bg-[#F9FAFB] hover:bg-[#F3F4F6] border border-[#E5E7EB] hover:border-[#D1D5DB] rounded-xl transition-all shadow-xs cursor-pointer group"
                >
                  <div className="flex items-center space-x-3 overflow-hidden min-w-0 pr-2">
                    <div
                      className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 font-bold text-[10px] uppercase border ${getFileBadgeStyle(
                        att.name
                      )}`}
                    >
                      {getFileExtension(att.name)}
                    </div>
                    <div className="overflow-hidden min-w-0">
                      <p
                        className="text-xs font-semibold text-gray-800 truncate group-hover:text-gray-900"
                        title={att.name}
                      >
                        {att.name}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        {formatFileSize(att.size)}
                      </p>
                    </div>
                  </div>

                  <div
                    className="p-1.5 text-gray-400 group-hover:text-[#00A854] rounded-lg transition-colors shrink-0"
                    title="Download attachment"
                  >
                    <Download className="h-4 w-4" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailDetailView;
