import React, { useState, useEffect, useRef } from 'react';
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
  FileText,
  CheckCircle2,
  Trash2,
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

  // Attached files (multi-file & Gmail style display)
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Rich Text Editor Ref and formatting states
  const editorRef = useRef<HTMLDivElement>(null);
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    orderedList: false,
    unorderedList: false,
    heading: false,
    quote: false,
    code: false,
  });
  const [alignMode, setAlignMode] = useState<'left' | 'center' | 'right'>('left');

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

  const processFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setAttachedFiles((prev) => {
      const existingKeys = new Set(prev.map((f) => `${f.name}_${f.size}`));
      const uniqueNewFiles = fileArray.filter((f) => !existingKeys.has(`${f.name}_${f.size}`));
      return [...prev, ...uniqueNewFiles];
    });

    // Check for CSV / TXT to extract leads
    for (const file of fileArray) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'csv' || ext === 'txt') {
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
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files) {
      processFiles(e.dataTransfer.files);
    }
  };

  const removeAttachment = (indexToRemove: number) => {
    setAttachedFiles((prev) => {
      const updated = prev.filter((_, idx) => idx !== indexToRemove);
      const remainingLead = updated.find((f) => {
        const ext = f.name.split('.').pop()?.toLowerCase();
        return ext === 'csv' || ext === 'txt';
      });
      setUploadedFile(remainingLead || null);
      return updated;
    });
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

  const updateFormatStates = () => {
    try {
      setActiveFormats({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        orderedList: document.queryCommandState('insertOrderedList'),
        unorderedList: document.queryCommandState('insertUnorderedList'),
        heading:
          document.queryCommandValue('formatBlock') === 'h2' ||
          document.queryCommandValue('formatBlock') === 'h1' ||
          document.queryCommandValue('formatBlock') === 'h3',
        quote: document.queryCommandValue('formatBlock') === 'blockquote',
        code: document.queryCommandValue('formatBlock') === 'pre',
      });
    } catch (e) {}
  };

  const executeCmd = (command: string, value: string | undefined = undefined) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    if (editorRef.current) {
      setBody(editorRef.current.innerHTML);
    }
    updateFormatStates();
  };

  const handleToggleHeading = () => {
    editorRef.current?.focus();
    const currentBlock = document.queryCommandValue('formatBlock');
    if (currentBlock === 'h2' || currentBlock === 'h1' || currentBlock === 'h3') {
      document.execCommand('formatBlock', false, '<p>');
    } else {
      document.execCommand('formatBlock', false, '<h2>');
    }
    if (editorRef.current) setBody(editorRef.current.innerHTML);
    updateFormatStates();
  };

  const handleToggleAlign = () => {
    editorRef.current?.focus();
    if (alignMode === 'left') {
      document.execCommand('justifyCenter', false);
      setAlignMode('center');
    } else if (alignMode === 'center') {
      document.execCommand('justifyRight', false);
      setAlignMode('right');
    } else {
      document.execCommand('justifyLeft', false);
      setAlignMode('left');
    }
    if (editorRef.current) setBody(editorRef.current.innerHTML);
    updateFormatStates();
  };

  const handleToggleQuote = () => {
    editorRef.current?.focus();
    const currentBlock = document.queryCommandValue('formatBlock');
    if (currentBlock === 'blockquote') {
      document.execCommand('formatBlock', false, '<p>');
    } else {
      document.execCommand('formatBlock', false, '<blockquote>');
    }
    if (editorRef.current) setBody(editorRef.current.innerHTML);
    updateFormatStates();
  };

  const handleFormatCode = () => {
    editorRef.current?.focus();
    const selection = window.getSelection();
    const selectedText = selection?.toString();
    if (selectedText) {
      document.execCommand(
        'insertHTML',
        false,
        `<code style="background-color: #f3f4f6; color: #00A854; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 13px;">${selectedText}</code>`
      );
    } else {
      const currentBlock = document.queryCommandValue('formatBlock');
      if (currentBlock === 'pre') {
        document.execCommand('formatBlock', false, '<p>');
      } else {
        document.execCommand('formatBlock', false, '<pre>');
      }
    }
    if (editorRef.current) setBody(editorRef.current.innerHTML);
    updateFormatStates();
  };

  const handleInsertLink = () => {
    editorRef.current?.focus();
    const selection = window.getSelection();
    const selectedText = selection?.toString() || '';
    const url = window.prompt('Enter link URL (e.g. https://reachinbox.ai):', 'https://');
    if (url && url !== 'https://') {
      if (selectedText) {
        document.execCommand('createLink', false, url);
      } else {
        document.execCommand(
          'insertHTML',
          false,
          `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: #00A854; text-decoration: underline;">${url}</a>`
        );
      }
      if (editorRef.current) setBody(editorRef.current.innerHTML);
      updateFormatStates();
    }
  };

  const handleSend = async () => {
    setError(null);

    // Collect all recipients
    let allRecipients = [...recipientsList];
    if (recipientInput.trim()) {
      allRecipients = Array.from(new Set([...allRecipients, ...extractEmails(recipientInput)]));
    }

    const htmlBody = editorRef.current?.innerHTML || body;
    const textOnly = editorRef.current?.innerText || '';

    if (!subject.trim() || !textOnly.trim()) {
      setError('Please provide subject and email message body.');
      return;
    }

    if (allRecipients.length === 0 && !uploadedFile) {
      setError('Please provide at least one recipient email address or attach a leads file.');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('senderEmail', selectedSender);
      formData.append('subject', subject);

      // Serialize attached files metadata into body comment so it persists across DB & views
      let allAttached = [...attachedFiles];
      if (uploadedFile && !allAttached.some((f) => f.name === uploadedFile.name)) {
        allAttached.push(uploadedFile);
      }
      let finalBody = htmlBody;
      if (allAttached.length > 0) {
        const attMeta = allAttached.map((file) => ({
          name: file.name,
          size: file.size,
          type: file.name.split('.').pop()?.toLowerCase() || 'file',
        }));
        finalBody += `\n<!--ATTACHMENTS:${JSON.stringify(attMeta)}-->`;
      }

      formData.append('body', finalBody);
      formData.append('delayBetweenSeconds', delayBetweenSeconds.toString());
      formData.append('hourlyLimit', (hourlyLimit || 50).toString());

      if (scheduledDateTime) {
        formData.append('startTime', new Date(scheduledDateTime).toISOString());
      } else {
        formData.append('startTime', new Date().toISOString());
      }

      if (uploadedFile) {
        formData.append('leadsFile', uploadedFile);
      }
      allRecipients.forEach((r) => formData.append('recipientEmails', r));

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
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex-1 flex flex-col h-full bg-white relative overflow-hidden font-['Inter',sans-serif] ${
        isDraggingOver ? 'ring-2 ring-dashed ring-[#00A854] bg-[#00A854]/5' : ''
      }`}
    >
      {/* Top Bar (Figma Exact: ← Compose New Email, 📎 count, ⏰, Send Later) */}
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
            className={`flex items-center space-x-1.5 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
              attachedFiles.length > 0
                ? 'bg-[#E6F4EA] text-[#00A854] hover:bg-[#d8f0de]'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            }`}
            title="Attach Lead List / Files (.csv, .txt, .pdf, images...)"
          >
            <Paperclip className="h-4 w-4" />
            <span className="text-xs font-semibold">{attachedFiles.length}</span>
            <input
              type="file"
              multiple
              accept=".csv,.txt,.pdf,.doc,.docx,.png,.jpg,.jpeg,.xlsx,.xls"
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
              multiple
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

        {/* Rich Formatting Toolbar (All Buttons Functional) */}
        <div className="border-t border-[#F0F0F0] pt-3 flex items-center space-x-3 text-gray-500">
          {/* Undo / Redo */}
          <div className="flex items-center space-x-1 border-r border-gray-200 pr-3">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => executeCmd('undo')}
              className="p-1.5 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              title="Undo (Ctrl+Z)"
            >
              <Undo className="h-4 w-4" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => executeCmd('redo')}
              className="p-1.5 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              title="Redo (Ctrl+Y)"
            >
              <Redo className="h-4 w-4" />
            </button>
          </div>

          {/* Heading (TT) / Bold / Italic / Underline */}
          <div className="flex items-center space-x-1 border-r border-gray-200 pr-3">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleToggleHeading}
              className={`px-2 py-1 font-bold text-xs rounded-lg transition-colors ${
                activeFormats.heading
                  ? 'bg-[#E6F4EA] text-[#00A854]'
                  : 'hover:text-gray-800 hover:bg-gray-100'
              }`}
              title="Heading (Large text)"
            >
              TT
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => executeCmd('bold')}
              className={`p-1.5 rounded-lg transition-colors ${
                activeFormats.bold
                  ? 'bg-[#E6F4EA] text-[#00A854]'
                  : 'hover:text-gray-800 hover:bg-gray-100'
              }`}
              title="Bold (Ctrl+B)"
            >
              <Bold className="h-4 w-4" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => executeCmd('italic')}
              className={`p-1.5 rounded-lg transition-colors ${
                activeFormats.italic
                  ? 'bg-[#E6F4EA] text-[#00A854]'
                  : 'hover:text-gray-800 hover:bg-gray-100'
              }`}
              title="Italic (Ctrl+I)"
            >
              <Italic className="h-4 w-4" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => executeCmd('underline')}
              className={`p-1.5 rounded-lg transition-colors ${
                activeFormats.underline
                  ? 'bg-[#E6F4EA] text-[#00A854]'
                  : 'hover:text-gray-800 hover:bg-gray-100'
              }`}
              title="Underline (Ctrl+U)"
            >
              <Underline className="h-4 w-4" />
            </button>
          </div>

          {/* Alignment / Lists */}
          <div className="flex items-center space-x-1 border-r border-gray-200 pr-3">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleToggleAlign}
              className={`p-1.5 rounded-lg transition-colors ${
                alignMode !== 'left'
                  ? 'bg-[#E6F4EA] text-[#00A854]'
                  : 'hover:text-gray-800 hover:bg-gray-100'
              }`}
              title={`Align: ${alignMode.toUpperCase()} (Click to toggle)`}
            >
              <AlignLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => executeCmd('insertOrderedList')}
              className={`p-1.5 rounded-lg transition-colors ${
                activeFormats.orderedList
                  ? 'bg-[#E6F4EA] text-[#00A854]'
                  : 'hover:text-gray-800 hover:bg-gray-100'
              }`}
              title="Numbered List"
            >
              <ListOrdered className="h-4 w-4" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => executeCmd('insertUnorderedList')}
              className={`p-1.5 rounded-lg transition-colors ${
                activeFormats.unorderedList
                  ? 'bg-[#E6F4EA] text-[#00A854]'
                  : 'hover:text-gray-800 hover:bg-gray-100'
              }`}
              title="Bulleted List"
            >
              <List className="h-4 w-4" />
            </button>
          </div>

          {/* Quote / Code / Link */}
          <div className="flex items-center space-x-1">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleToggleQuote}
              className={`p-1.5 rounded-lg transition-colors ${
                activeFormats.quote
                  ? 'bg-[#E6F4EA] text-[#00A854]'
                  : 'hover:text-gray-800 hover:bg-gray-100'
              }`}
              title="Quote Block"
            >
              <Quote className="h-4 w-4" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleFormatCode}
              className={`p-1.5 rounded-lg transition-colors ${
                activeFormats.code
                  ? 'bg-[#E6F4EA] text-[#00A854]'
                  : 'hover:text-gray-800 hover:bg-gray-100'
              }`}
              title="Inline Code / Code Block"
            >
              <Code className="h-4 w-4" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleInsertLink}
              className="p-1.5 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              title="Insert Link"
            >
              <Link2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Rich Text Editable Area */}
        <div className="relative min-h-[220px] pt-2">
          {(!body || body === '<br>' || body.trim() === '') && (
            <div
              onClick={() => editorRef.current?.focus()}
              className="absolute top-2 left-0 text-sm text-gray-400 pointer-events-none select-none"
            >
              Type Your Reply...
            </div>
          )}
          <div
            ref={editorRef}
            contentEditable
            onInput={() => {
              if (editorRef.current) {
                setBody(editorRef.current.innerHTML);
              }
              updateFormatStates();
            }}
            onKeyUp={updateFormatStates}
            onMouseUp={updateFormatStates}
            className="rich-editor-content w-full min-h-[220px] text-sm text-gray-800 leading-relaxed focus:outline-none"
          />
        </div>

        {/* Gmail-style Attached Files Cards Grid */}
        {attachedFiles.length > 0 && (
          <div className="pt-4 border-t border-gray-100 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-gray-700 flex items-center space-x-1.5">
                <Paperclip className="h-3.5 w-3.5 text-[#00A854]" />
                <span>Attached Files ({attachedFiles.length})</span>
              </span>
              <span className="text-[11px] text-gray-400">
                {formatFileSize(attachedFiles.reduce((acc, f) => acc + f.size, 0))} total
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {attachedFiles.map((file, idx) => (
                <div
                  key={`${file.name}-${idx}`}
                  className="group relative flex items-center justify-between p-2.5 bg-[#F9FAFB] hover:bg-[#F3F4F6] border border-[#E5E7EB] hover:border-[#D1D5DB] rounded-xl transition-all shadow-xs"
                >
                  <div className="flex items-center space-x-2.5 overflow-hidden min-w-0 pr-2">
                    {/* Badge */}
                    <div
                      className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 font-bold text-[10px] uppercase border ${getFileBadgeStyle(
                        file.name
                      )}`}
                    >
                      {getFileExtension(file.name)}
                    </div>
                    {/* Info */}
                    <div className="overflow-hidden min-w-0">
                      <p
                        className="text-xs font-semibold text-gray-800 truncate group-hover:text-gray-900"
                        title={file.name}
                      >
                        {file.name}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                  </div>

                  {/* Remove Button */}
                  <button
                    type="button"
                    onClick={() => removeAttachment(idx)}
                    className="p-1 text-gray-400 hover:text-red-500 hover:bg-white rounded-lg transition-colors shrink-0"
                    title="Remove attachment"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
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
