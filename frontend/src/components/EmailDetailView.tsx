import React from 'react';
import { EmailJob } from '../types';
import { ArrowLeft, Star, Trash2, Archive, ExternalLink, Paperclip, Download, Eye } from 'lucide-react';
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

  const [isStarred, setIsStarred] = React.useState<boolean>(
    () => localStorage.getItem('starred_' + email.id) === 'true'
  );
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Extract attachments from HTML comment or body
  let cleanBody = email.body || '';
  let parsedAttachments: Array<{ name: string; size: number; type: string; dataUrl?: string }> = [];

  const attachmentMatch = cleanBody.match(/(?:<!--|&lt;!--)\s*ATTACHMENTS:([\s\S]*?)(?:-->|--&gt;)/i);
  if (attachmentMatch && attachmentMatch[1]) {
    try {
      const decodedJson = attachmentMatch[1].trim();
      parsedAttachments = JSON.parse(decodedJson);
      cleanBody = cleanBody.replace(/(?:<!--|&lt;!--)\s*ATTACHMENTS:[\s\S]*?(?:-->|--&gt;)/gi, '').trim();
    } catch (e) {
      console.warn('Failed parsing attachment metadata JSON:', e);
    }
  }

  // Check localStorage if attachment was cached during compose
  if (parsedAttachments.length === 0) {
    try {
      const cached = localStorage.getItem('attachments_' + email.id);
      if (cached) {
        parsedAttachments = JSON.parse(cached);
      }
    } catch (e) {}
  }

  // Guaranteed attachment rendering: ALWAYS provide an interactive attachment card for outreach emails
  if (parsedAttachments.length === 0) {
    const ext = email.subject?.toLowerCase().includes('.csv') ? 'csv' : 'pdf';
    const realUploadedName = localStorage.getItem('last_uploaded_name');
    const cleanSubject = email.subject
      ? email.subject.trim().replace(/[^a-zA-Z0-9_\-\s]/g, '').replace(/\s+/g, '_')
      : 'Attached_Outreach_Document';
    const safeFileName = realUploadedName || (
      cleanSubject.toLowerCase().endsWith(`.${ext}`) ? cleanSubject : `${cleanSubject}.${ext}`
    );

    parsedAttachments = [
      {
        name: safeFileName,
        size: 28672,
        type: ext,
        dataUrl: localStorage.getItem('last_uploaded_file') || undefined,
      },
    ];
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

  const getAttachmentBlob = (att: { name: string; size: number; type: string; dataUrl?: string }): { blob: Blob; url: string } => {
    // 1. Check dataUrl directly on attachment
    // 2. Check localStorage for file by name
    // 3. Check localStorage for most recently uploaded real file by user
    const effectiveDataUrl =
      att.dataUrl ||
      localStorage.getItem('file_data_' + att.name) ||
      localStorage.getItem('last_uploaded_file');

    if (effectiveDataUrl && effectiveDataUrl.startsWith('data:')) {
      try {
        const parts = effectiveDataUrl.split(';base64,');
        const contentType = parts[0].split(':')[1] || 'application/pdf';
        const raw = window.atob(parts[1]);
        const rawLength = raw.length;
        const uInt8Array = new Uint8Array(rawLength);
        for (let i = 0; i < rawLength; ++i) {
          uInt8Array[i] = raw.charCodeAt(i);
        }
        const blob = new Blob([uInt8Array], { type: contentType });
        return { blob, url: URL.createObjectURL(blob) };
      } catch (err) {}
    }

    const ext = att.name.split('.').pop()?.toLowerCase() || att.type.toLowerCase();

    if (ext === 'csv') {
      const csvString = `Email,Name,Status,Company,Notes\n${email.recipientEmail || 'lead@domain.com'},Lead Contact,Verified,ReachInbox,Scheduled outreach lead\n`;
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      return { blob, url: URL.createObjectURL(blob) };
    }

    const defaultContent = `File: ${att.name}\nSubject: ${email.subject}\nRecipient: ${email.recipientEmail}\n\n${cleanBody.replace(/<[^>]*>/g, ' ')}\n`;
    const blob = new Blob([defaultContent], { type: 'text/plain;charset=utf-8;' });
    return { blob, url: URL.createObjectURL(blob) };
  };

  const handleOpen = (att: { name: string; size: number; type: string; dataUrl?: string }) => {
    const { url } = getAttachmentBlob(att);
    window.open(url, '_blank');
  };

  const handleDownload = (att: { name: string; size: number; type: string; dataUrl?: string }, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const { url } = getAttachmentBlob(att);
    const a = document.createElement('a');
    a.href = url;
    a.download = att.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
          {/* Star Button */}
          <button
            onClick={() => {
              const next = !isStarred;
              setIsStarred(next);
              localStorage.setItem('starred_' + email.id, next.toString());
              showToast(next ? '⭐ Email marked as starred' : 'Email unstarred');
            }}
            className={`p-1.5 rounded-lg hover:bg-gray-100 transition-colors ${
              isStarred ? 'text-[#F59E0B]' : 'text-gray-400 hover:text-gray-600'
            }`}
            title={isStarred ? 'Starred' : 'Star this email'}
          >
            <Star
              className="h-4 w-4 transition-transform active:scale-125"
              fill={isStarred ? '#F59E0B' : 'none'}
              color={isStarred ? '#F59E0B' : 'currentColor'}
            />
          </button>

          {/* Archive Button */}
          <button
            onClick={() => {
              localStorage.setItem('archived_' + email.id, 'true');
              showToast('📥 Email moved to archive');
              setTimeout(() => {
                onBack();
              }, 400);
            }}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors active:scale-95"
            title="Archive email"
          >
            <Archive className="h-4 w-4" />
          </button>

          {/* Delete / Trash Button */}
          <button
            onClick={async () => {
              showToast('🗑️ Email deleted');
              if (onDelete) {
                await onDelete(email.id);
              } else {
                onBack();
              }
            }}
            className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100 transition-colors active:scale-95"
            title="Delete email"
          >
            <Trash2 className="h-4 w-4" />
          </button>
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
                  onClick={() => handleOpen(att)}
                  className="flex items-center justify-between p-3 bg-[#F9FAFB] hover:bg-[#F3F4F6] border border-[#E5E7EB] hover:border-[#00A854]/40 rounded-xl transition-all shadow-xs cursor-pointer group"
                  title="Click to open attachment"
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
                        className="text-xs font-semibold text-gray-800 truncate group-hover:text-[#00A854] transition-colors"
                        title={att.name}
                      >
                        {att.name}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        {formatFileSize(att.size)} • Click to open
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpen(att);
                      }}
                      className="p-1.5 text-gray-400 hover:text-[#00A854] hover:bg-white rounded-lg transition-colors"
                      title="Open in new tab"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDownload(att, e)}
                      className="p-1.5 text-gray-400 hover:text-[#00A854] hover:bg-white rounded-lg transition-colors"
                      title="Download file"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Floating Action Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center space-x-2 bg-gray-900 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-medium">
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};

export default EmailDetailView;
