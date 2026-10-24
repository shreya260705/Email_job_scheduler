import React, { useState, useEffect } from 'react';
import { X, Upload, Mail, Clock, ShieldAlert, Sparkles, CheckCircle2 } from 'lucide-react';
import api from '../services/api';
import { SenderOption } from '../types';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [senders, setSenders] = useState<SenderOption[]>([]);
  const [selectedSender, setSelectedSender] = useState<string>('outreach@growth.reachinbox.ai');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipientsInput, setRecipientsInput] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [detectedEmailCount, setDetectedEmailCount] = useState<number>(0);

  const [startTime, setStartTime] = useState<string>('');
  const [sendImmediately, setSendImmediately] = useState<boolean>(true);
  const [delayBetweenSeconds, setDelayBetweenSeconds] = useState<number>(2);
  const [hourlyLimit, setHourlyLimit] = useState<number>(50);

  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      api.getSenders()
        .then((data) => {
          setSenders(data);
          if (data.length > 0) setSelectedSender(data[0].email);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  // Recipient email count detection from textarea
  useEffect(() => {
    if (!uploadedFile && recipientsInput) {
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const matches = recipientsInput.match(emailRegex) || [];
      const unique = Array.from(new Set(matches.map((m) => m.toLowerCase())));
      setDetectedEmailCount(unique.length);
    } else if (!uploadedFile) {
      setDetectedEmailCount(0);
    }
  }, [recipientsInput, uploadedFile]);

  // Handle CSV / TXT file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const matches = text.match(emailRegex) || [];
      const unique = Array.from(new Set(matches.map((m) => m.toLowerCase())));
      setDetectedEmailCount(unique.length);
    };
    reader.readAsText(file);
  };

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!subject.trim() || !body.trim()) {
      setErrorMessage('Please provide both subject and email body.');
      return;
    }

    if (!uploadedFile && detectedEmailCount === 0) {
      setErrorMessage('Please provide at least one recipient email address or upload a CSV.');
      return;
    }

    setLoading(true);

    try {
      let finalBody = body;
      if (uploadedFile) {
        const attMeta = [{
          name: uploadedFile.name,
          size: uploadedFile.size,
          type: uploadedFile.name.split('.').pop()?.toLowerCase() || 'file',
        }];
        finalBody += `\n<!--ATTACHMENTS:${JSON.stringify(attMeta)}-->`;
      }

      const formData = new FormData();
      formData.append('senderEmail', selectedSender);
      formData.append('subject', subject);
      formData.append('body', finalBody);
      formData.append('delayBetweenSeconds', delayBetweenSeconds.toString());
      formData.append('hourlyLimit', hourlyLimit.toString());

      if (!sendImmediately && startTime) {
        formData.append('startTime', new Date(startTime).toISOString());
      } else {
        formData.append('startTime', new Date().toISOString());
      }

      if (uploadedFile) {
        formData.append('leadsFile', uploadedFile);
      } else {
        formData.append('recipientEmails', recipientsInput);
      }

      await api.scheduleEmails(formData);
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Failed to schedule emails. Please check inputs.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#12161F] border border-[#1F2430] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#1F2430] flex items-center justify-between bg-[#151A24]">
          <div className="flex items-center space-x-2">
            <Mail className="h-5 w-5 text-indigo-400" />
            <h2 className="text-base font-semibold text-white">Compose & Schedule Outreach</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 p-1 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSchedule} className="p-6 overflow-y-auto space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
              {errorMessage}
            </div>
          )}

          {/* Sender Selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
              Sender Identity (Multi-Sender Support)
            </label>
            <select
              value={selectedSender}
              onChange={(e) => setSelectedSender(e.target.value)}
              className="w-full px-3 py-2 bg-[#0B0E14] border border-[#1F2430] rounded-lg text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
            >
              {senders.map((s) => (
                <option key={s.id || s.email} value={s.email}>
                  {s.name} ({s.email})
                </option>
              ))}
            </select>
          </div>

          {/* Recipients / File Upload */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider">
                Recipients (CSV / TXT / Paste)
              </label>
              {detectedEmailCount > 0 && (
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{detectedEmailCount} email{detectedEmailCount > 1 ? 's' : ''} detected</span>
                </span>
              )}
            </div>

            <div className="space-y-2">
              <textarea
                value={recipientsInput}
                onChange={(e) => {
                  setRecipientsInput(e.target.value);
                  setUploadedFile(null);
                }}
                rows={2}
                disabled={!!uploadedFile}
                placeholder="Enter recipient emails separated by comma or newlines..."
                className="w-full px-3 py-2 bg-[#0B0E14] border border-[#1F2430] rounded-lg text-sm text-gray-200 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
              />

              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>or upload lead list (.csv, .txt):</span>
                <label className="cursor-pointer inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 transition-colors">
                  <Upload className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Choose CSV / TXT</span>
                  <input
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {uploadedFile && (
                <div className="flex items-center justify-between p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg mt-2">
                  <div className="flex items-center space-x-2 overflow-hidden">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
                      FILE
                    </span>
                    <span className="text-xs font-medium text-gray-200 truncate">
                      {uploadedFile.name}
                    </span>
                    <span className="text-[11px] text-gray-400 shrink-0">
                      ({(uploadedFile.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setUploadedFile(null);
                      setDetectedEmailCount(0);
                    }}
                    className="text-gray-400 hover:text-red-400 p-1 rounded transition-colors shrink-0"
                    title="Remove attached file"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
              Email Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Transforming cold outreach with ReachInbox AI"
              className="w-full px-3 py-2 bg-[#0B0E14] border border-[#1F2430] rounded-lg text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
              Email Body
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="Hi there, I noticed your team is expanding outbound campaigns..."
              className="w-full px-3 py-2 bg-[#0B0E14] border border-[#1F2430] rounded-lg text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Scheduling & Rate Limiting Controls */}
          <div className="p-3.5 rounded-xl bg-[#0B0E14] border border-[#1F2430] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center space-x-1.5">
                <Clock className="h-3.5 w-3.5 text-indigo-400" />
                <span>Scheduling Parameters</span>
              </span>
              <label className="flex items-center space-x-2 text-xs text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendImmediately}
                  onChange={(e) => setSendImmediately(e.target.checked)}
                  className="rounded border-gray-700 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Start Immediately</span>
              </label>
            </div>

            {!sendImmediately && (
              <div>
                <label className="block text-[11px] text-gray-400 mb-1">
                  Start Date & Time (BullMQ Delayed Job - No Cron)
                </label>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#12161F] border border-[#1F2430] rounded-lg text-xs text-gray-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-1 border-t border-[#1F2430]">
              <div>
                <label className="block text-[11px] text-gray-400 mb-1">
                  Delay Between Sends (sec)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={delayBetweenSeconds}
                  onChange={(e) => setDelayBetweenSeconds(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full px-3 py-1.5 bg-[#12161F] border border-[#1F2430] rounded-lg text-xs text-gray-200 focus:outline-none focus:border-indigo-500"
                />
                <span className="text-[10px] text-gray-500">Provider throttling simulation</span>
              </div>
              <div>
                <label className="block text-[11px] text-gray-400 mb-1">
                  Sender Hourly Limit
                </label>
                <input
                  type="number"
                  min="1"
                  value={hourlyLimit}
                  onChange={(e) => setHourlyLimit(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-1.5 bg-[#12161F] border border-[#1F2430] rounded-lg text-xs text-gray-200 focus:outline-none focus:border-indigo-500"
                />
                <span className="text-[10px] text-gray-500">Triggers auto-delay & Slack alert</span>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="pt-2 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center space-x-2 px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm shadow-md shadow-indigo-600/30 transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Enqueuing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Schedule {detectedEmailCount > 0 ? `(${detectedEmailCount})` : ''} Emails</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ComposeModal;
