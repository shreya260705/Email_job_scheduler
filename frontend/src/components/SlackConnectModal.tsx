import React, { useState } from 'react';
import { X, Slack, CheckCircle2, Send, AlertTriangle } from 'lucide-react';
import api from '../services/api';

interface SlackConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  connected: boolean;
  channel?: string;
  onStatusChanged: () => void;
}

export const SlackConnectModal: React.FC<SlackConnectModalProps> = ({
  isOpen,
  onClose,
  connected,
  channel,
  onStatusChanged,
}) => {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [channelName, setChannelName] = useState('#all-new-workspace');
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  if (!isOpen) return null;

  const handleConnectWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl) return;

    setLoading(true);
    setMessage(null);
    try {
      await api.connectSlackWebhook(webhookUrl, channelName);
      setMessage({ text: 'Slack webhook connected successfully!', type: 'success' });
      onStatusChanged();
    } catch (err: any) {
      setMessage({
        text: err.response?.data?.message || 'Failed to connect Slack webhook.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendTestAlert = async () => {
    setTestLoading(true);
    setMessage(null);
    try {
      const res = await api.testSlackAlert();
      setMessage({ text: res.message || 'Test notification sent to Slack!', type: 'success' });
    } catch (err: any) {
      setMessage({
        text: err.response?.data?.message || 'Failed to send test alert.',
        type: 'error',
      });
    } finally {
      setTestLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await api.disconnectSlack();
      setMessage({ text: 'Slack disconnected.', type: 'success' });
      onStatusChanged();
    } catch (err: any) {
      setMessage({ text: 'Error disconnecting.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#12161F] border border-[#1F2430] w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1F2430] flex items-center justify-between bg-[#151A24]">
          <div className="flex items-center space-x-2">
            <Slack className="h-5 w-5 text-emerald-400" />
            <h2 className="text-base font-semibold text-white">Slack Rate-Limit Integration</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 p-1 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {message && (
            <div
              className={`p-3 rounded-lg text-xs flex items-center space-x-2 ${
                message.type === 'success'
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                  : 'bg-red-500/10 border border-red-500/30 text-red-400'
              }`}
            >
              {message.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          {/* Current Status */}
          <div className="p-4 rounded-xl bg-[#0B0E14] border border-[#1F2430] flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div
                className={`h-9 w-9 rounded-lg flex items-center justify-center ${
                  connected
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}
              >
                <Slack className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white">
                  {connected ? 'Slack Connected & Active' : 'Slack Not Connected'}
                </p>
                <p className="text-[11px] text-gray-400">
                  {connected
                    ? `Posting to ${channel || '#all-new-workspace'}`
                    : 'Rate-limit breaches will not dispatch Slack pings until connected.'}
                </p>
              </div>
            </div>

            {connected && (
              <button
                onClick={handleSendTestAlert}
                disabled={testLoading}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-medium transition-colors"
              >
                <Send className="h-3 w-3" />
                <span>{testLoading ? 'Sending...' : 'Test Alert'}</span>
              </button>
            )}
          </div>

          {/* Connect form */}
          {!connected ? (
            <form onSubmit={handleConnectWebhook} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1">
                  Incoming Webhook URL
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://hooks.slack.com/services/..."
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0B0E14] border border-[#1F2430] rounded-lg text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1">
                  Target Channel Name
                </label>
                <input
                  type="text"
                  placeholder="#all-new-workspace"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0B0E14] border border-[#1F2430] rounded-lg text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition-all"
              >
                {loading ? 'Connecting...' : 'Connect Slack Webhook'}
              </button>
            </form>
          ) : (
            <div className="pt-2 flex justify-end">
              <button
                onClick={handleDisconnect}
                disabled={loading}
                className="px-4 py-2 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 border border-red-500/20 transition-colors"
              >
                Disconnect Slack
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SlackConnectModal;
