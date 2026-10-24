import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Paperclip,
  Clock,
  Upload,
  X,
  Undo,
  Redo,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  List,
  ListOrdered,
  Quote,
  Code,
  Link2,
} from 'lucide-react';
import api from '../services/api';
import { SenderOption } from '../types';

interface ComposeViewProps {
  onBack: () => void;
  onSuccess: () => void;
  userEmail: string;
}

export const ComposeView: React.FC<ComposeViewProps> = ({
  onBack,
  onSuccess,
  userEmail,
}) => {
  const [senders, setSenders] = useState<SenderOption[]>([]);
  const [selectedSender, setSelectedSender] = useState<string>(userEmail || 'oliver.brown@domain.io');
  const [recipientInput, setRecipientInput] = useState('');
  const [recipientsList, setRecipientsList] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [delayBetweenSeconds, setDelayBetweenSeconds] = useState<number>(0);
  const [hourlyLimit, setHourlyLimit] = useState<number>(0);

  // Send Later popup states
  const [isSendLaterOpen, setIsSendLaterOpen] = useState(false);
  const [scheduledDateTime, setScheduledDateTime] = useState<string>('');

  // Attached files
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getSenders()
      .then((data) => {
        setSenders(data);
        if (data.length > 0 && !data.some((s) => s.email === selectedSender)) {
          setSelectedSender(data[0].email);
        }
      })
      .catch(() => {});
  }, [selectedSender]);

  const extractEmails = (text: string): string[] => {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = text.match(emailRegex) || [];
    return Array.from(new Set(matches.map((m) => m.toLowerCase().trim())));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const emails = extractEmails(text);
      if (emails.length > 0) {
        setRecipientsList((prev) => Array.from(new Set([...prev, ...emails])));
        setRecipientInput('');
      }
    };
    reader.readAsText(file);
  };

  const handleRecipientKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const extracted = extractEmails(recipientInput);
      if (extracted.length > 0) {
        setRecipientsList((prev) => Array.from(new Set([...prev, ...extracted])));
        setRecipientInput('');
      } else if (recipientInput.trim()) {
        setRecipientsList((prev) => Array.from(new Set([...prev, recipientInput.trim()])));
        setRecipientInput('');
      }
    }
  };

  const removeRecipient = (indexToRemove: number) => {
    setRecipientsList((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSend = async () => {
    setError(null);

    // Collect all recipients
    let allRecipients = [...recipientsList];
    if (recipientInput.trim()) {
      allRecipients = Array.from(new Set([...allRecipients, ...extractEmails(recipientInput)]));
    }

    if (!subject.trim() || !body.trim()) {
      setError('Please provide subject and email message body.');
      return;
    }

    if (allRecipients.length === 0 && !uploadedFile) {
      setError('Please provide at least one recipient email address.');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('senderEmail', selectedSender);
      formData.append('subject', subject);
      formData.append('body', body);
      formData.append('delayBetweenSeconds', delayBetweenSeconds.toString());
      formData.append('hourlyLimit', (hourlyLimit || 50).toString());

      if (scheduledDateTime) {
        formData.append('startTime', new Date(scheduledDateTime).toISOString());
      } else {
        formData.append('startTime', new Date().toISOString());
      }

      if (uploadedFile && allRecipients.length === 0) {
        formData.append('leadsFile', uploadedFile);
      } else {
        allRecipients.forEach((r) => formData.append('recipientEmails', r));
      }

      await api.scheduleEmails(formData);
      onSuccess();
      onBack();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to dispatch email.');
    } finally {
      setLoading(false);
    }
  };

  const setPresetTime = (preset: 'tomorrow' | '10am' | '11am' | '3pm') => {
    const target = new Date();
    target.setDate(target.getDate() + 1);
    if (preset === '10am') target.setHours(10, 0, 0, 0);
    else if (preset === '11am') target.setHours(11, 0, 0, 0);
    else if (preset === '3pm') target.setHours(15, 0, 0, 0);
    else target.setHours(9, 0, 0, 0);

    const pad = (n: number) => String(n).padStart(2, '0');
    const isoString = `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}T${pad(target.getHours())}:${pad(target.getMinutes())}`;
    setScheduledDateTime(isoString);
  };

  // Preview chips for recipients
  const visibleChips = recipientsList.slice(0, 3);
  const remainingCount = recipientsList.length - 3;

  return (
    <div className="flex-1 flex flex-col h-full bg-white relative overflow-hidden font-['Inter',sans-serif]">
      {/* Top Bar (Figma Exact: ← Compose New Email, 📎 1, ⏰, Send Later) */}
      <div className="h-16 px-6 border-b border-[#F0F0F0] flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBack}
            className="p-1.5 text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-base font-bold text-gray-900">Compose New Email</h2>
        </div>

        {/* Right Action Icons & Button */}
        <div className="flex items-center space-x-4">
          {/* File attachment / Lead list icon with count */}
          <label
            className="flex items-center space-x-1 p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
            title="Attach Lead List (.csv, .txt)"
          >
            <Paperclip className="h-4 w-4" />
            <span className="text-xs text-gray-500 font-medium">{uploadedFile ? '1' : '0'}</span>
            <input
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          {/* Clock icon for Send Later */}
          <button
            onClick={() => setIsSendLaterOpen(!isSendLaterOpen)}
            className={`p-1.5 rounded-lg transition-colors ${
              scheduledDateTime
                ? 'text-[#00A854] bg-[#E6F4EA]'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            }`}
            title="Pick Schedule Time"
          >
            <Clock className="h-4 w-4" />
          </button>

          {/* Send Later Button (Figma Exact: Outlined Green with text 'Send Later') */}
          <button
            onClick={handleSend}
            disabled={loading}
            className="px-5 py-1.5 rounded-full border border-[#00A854] hover:bg-[#00A854]/5 text-[#00A854] font-medium text-xs transition-colors disabled:opacity-50"
          >
            {loading ? 'Scheduling...' : 'Send Later'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 p-3 rounded-lg text-xs bg-red-50 border border-red-200 text-red-600">
          {error}
        </div>
      )}

      {/* Main Compose Form */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4 max-w-4xl">
        {/* From Field */}
        <div className="flex items-center space-x-6">
          <span className="w-16 text-sm text-gray-400 font-normal">From</span>
          <select
            value={selectedSender}
            onChange={(e) => setSelectedSender(e.target.value)}
            className="px-3.5 py-1.5 bg-[#F3F4F6] border-0 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-gray-300"
          >
            {senders.map((s) => (
              <option key={s.id || s.email} value={s.email}>
                {s.email}
              </option>
            ))}
          </select>
        </div>

        {/* To Field with Green Chips and 'Upload List' Link (Figma Exact) */}
        <div className="flex items-center space-x-6 border-b border-[#F0F0F0] pb-3">
          <span className="w-16 text-sm text-gray-400 font-normal">To</span>
          <div className="flex-1 flex items-center flex-wrap gap-2">
            {/* Render Chips */}
            {visibleChips.map((email, idx) => (
              <span
                key={idx}
                className="inline-flex items-center space-x-1 px-3 py-0.5 rounded-full text-xs font-medium bg-[#E6F4EA] text-gray-900 border border-[#00A854]/20"
              >
                <span>{email}</span>
                <button
                  type="button"
                  onClick={() => removeRecipient(idx)}
                  className="hover:text-red-500 ml-1"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}

            {/* Remaining Count Chip */}
            {remainingCount > 0 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E6F4EA] text-gray-900 border border-[#00A854]/20">
                +{remainingCount}
              </span>
            )}

            {/* Input field */}
            <input
              type="text"
              placeholder={recipientsList.length === 0 ? 'recipient@example.com' : 'Add another recipient...'}
              value={recipientInput}
              onChange={(e) => setRecipientInput(e.target.value)}
              onKeyDown={handleRecipientKeyDown}
              className="flex-1 min-w-[200px] py-1 text-sm text-gray-900 placeholder-gray-400 border-0 focus:outline-none"
            />
          </div>

          {/* Upload List link on the right (Figma Exact) */}
          <label className="flex items-center space-x-1.5 text-xs font-medium text-[#00A854] hover:text-[#00873D] cursor-pointer shrink-0">
            <Upload className="h-3.5 w-3.5" />
            <span>Upload List</span>
            <input
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>

        {/* Subject Field */}
        <div className="flex items-center space-x-6 border-b border-[#F0F0F0] pb-3">
          <span className="w-16 text-sm text-gray-400 font-normal">Subject</span>
          <input
            type="text"
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="flex-1 py-1 text-sm text-gray-900 placeholder-gray-400 border-0 focus:outline-none font-medium"
          />
        </div>

        {/* Parameters Row: Delay between 2 emails & Hourly Limit (Figma Exact) */}
        <div className="flex items-center space-x-8 py-1">
          <div className="flex items-center space-x-3">
            <span className="text-xs text-gray-700 font-medium">Delay between 2 emails</span>
            <input
              type="number"
              min="0"
              value={delayBetweenSeconds || ''}
              placeholder="00"
              onChange={(e) => setDelayBetweenSeconds(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-14 px-2 py-1 text-center bg-white border border-[#D1D5DB] rounded-md text-xs text-gray-800 focus:outline-none focus:border-[#00A854]"
            />
          </div>

          <div className="flex items-center space-x-3">
            <span className="text-xs text-gray-700 font-medium">Hourly Limit</span>
            <input
              type="number"
              min="0"
              value={hourlyLimit || ''}
              placeholder="00"
              onChange={(e) => setHourlyLimit(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-14 px-2 py-1 text-center bg-white border border-[#D1D5DB] rounded-md text-xs text-gray-800 focus:outline-none focus:border-[#00A854]"
            />
          </div>
        </div>

        {/* Rich Formatting Toolbar (Figma Exact) */}
        <div className="border-t border-[#F0F0F0] pt-3 flex items-center space-x-4 text-gray-400">
          <div className="flex items-center space-x-2 border-r border-gray-200 pr-3">
            <button type="button" className="p-1 hover:text-gray-700 rounded"><Undo className="h-4 w-4" /></button>
            <button type="button" className="p-1 hover:text-gray-700 rounded"><Redo className="h-4 w-4" /></button>
          </div>
          <div className="flex items-center space-x-2 border-r border-gray-200 pr-3">
            <button type="button" className="p-1 font-bold text-xs hover:text-gray-700 rounded">TT</button>
            <button type="button" className="p-1 hover:text-gray-700 rounded"><Bold className="h-4 w-4" /></button>
            <button type="button" className="p-1 hover:text-gray-700 rounded"><Italic className="h-4 w-4" /></button>
            <button type="button" className="p-1 hover:text-gray-700 rounded"><Underline className="h-4 w-4" /></button>
          </div>
          <div className="flex items-center space-x-2 border-r border-gray-200 pr-3">
            <button type="button" className="p-1 hover:text-gray-700 rounded"><AlignLeft className="h-4 w-4" /></button>
            <button type="button" className="p-1 hover:text-gray-700 rounded"><ListOrdered className="h-4 w-4" /></button>
            <button type="button" className="p-1 hover:text-gray-700 rounded"><List className="h-4 w-4" /></button>
          </div>
          <div className="flex items-center space-x-2">
            <button type="button" className="p-1 hover:text-gray-700 rounded"><Quote className="h-4 w-4" /></button>
            <button type="button" className="p-1 hover:text-gray-700 rounded"><Code className="h-4 w-4" /></button>
            <button type="button" className="p-1 hover:text-gray-700 rounded"><Link2 className="h-4 w-4" /></button>
          </div>
        </div>

        {/* Body Textarea */}
        <textarea
          rows={12}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Type Your Reply..."
          className="w-full text-sm text-gray-800 placeholder-gray-400 border-0 focus:outline-none resize-none pt-2 leading-relaxed"
        />
      </div>

      {/* "Send Later" Pop-over widget on right (Figma Exact) */}
      {isSendLaterOpen && (
        <div className="absolute top-16 right-8 w-72 bg-white border border-[#E5E7EB] rounded-2xl shadow-xl p-5 space-y-4 z-40">
          <h3 className="font-bold text-sm text-gray-900">Send Later</h3>

          {/* Date & Time Picker */}
          <div>
            <input
              type="datetime-local"
              value={scheduledDateTime}
              onChange={(e) => setScheduledDateTime(e.target.value)}
              className="w-full py-2 px-3 text-xs border-b border-gray-200 text-gray-800 focus:outline-none focus:border-[#00A854]"
            />
          </div>

          {/* Presets */}
          <div className="space-y-2 text-xs text-gray-600">
            <button
              type="button"
              onClick={() => setPresetTime('tomorrow')}
              className="block w-full text-left py-1 hover:text-[#00A854] transition-colors"
            >
              Tomorrow
            </button>
            <button
              type="button"
              onClick={() => setPresetTime('10am')}
              className="block w-full text-left py-1 hover:text-[#00A854] transition-colors"
            >
              Tomorrow, 10:00 AM
            </button>
            <button
              type="button"
              onClick={() => setPresetTime('11am')}
              className="block w-full text-left py-1 hover:text-[#00A854] transition-colors"
            >
              Tomorrow, 11:00 AM
            </button>
            <button
              type="button"
              onClick={() => setPresetTime('3pm')}
              className="block w-full text-left py-1 hover:text-[#00A854] transition-colors"
            >
              Tomorrow, 3:00 PM
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => {
                setScheduledDateTime('');
                setIsSendLaterOpen(false);
              }}
              className="text-xs text-gray-500 hover:text-gray-800 font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setIsSendLaterOpen(false)}
              className="px-4 py-1 rounded-full border border-[#00A854] text-[#00A854] hover:bg-[#00A854]/5 text-xs font-semibold transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComposeView;
