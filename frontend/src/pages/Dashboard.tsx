import React, { useState, useEffect, useCallback } from 'react';
import { User, EmailJob, SchedulerMetrics } from '../types';
import Sidebar from '../components/Sidebar';
import HeaderSearch from '../components/HeaderSearch';
import ScheduledList from '../components/ScheduledList';
import SentList from '../components/SentList';
import ComposeView from '../components/ComposeView';
import EmailDetailView from '../components/EmailDetailView';
import SlackConnectModal from '../components/SlackConnectModal';
import api from '../services/api';

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [viewMode, setViewMode] = useState<'list' | 'compose' | 'detail'>('list');
  const [selectedEmail, setSelectedEmail] = useState<EmailJob | null>(null);

  const [metrics, setMetrics] = useState<SchedulerMetrics | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Lists
  const [scheduledEmails, setScheduledEmails] = useState<EmailJob[]>([]);
  const [sentEmails, setSentEmails] = useState<EmailJob[]>([]);
  const [loading, setLoading] = useState(false);

  // Slack state
  const [isSlackModalOpen, setIsSlackModalOpen] = useState(false);
  const [slackConnected, setSlackConnected] = useState(user.slackConnected || false);
  const [slackChannel, setSlackChannel] = useState(user.slackChannel || '#all-new-workspace');

  const fetchMetrics = useCallback(async () => {
    try {
      const data = await api.getMetrics();
      setMetrics(data);
    } catch (err) {}
  }, []);

  const fetchSlackStatus = useCallback(async () => {
    try {
      const data = await api.getSlackStatus();
      setSlackConnected(data.connected);
      if (data.channel) setSlackChannel(data.channel);
    } catch (err) {}
  }, []);

  const fetchScheduled = useCallback(async (query = '', isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const data = await api.getScheduledEmails(query);
      setScheduledEmails(data.emails || []);
    } catch (err) {
      console.error(err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  const fetchSent = useCallback(async (query = '', isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const data = await api.getSentEmails(query);
      setSentEmails(data.emails || []);
    } catch (err) {
      console.error(err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    fetchSlackStatus();
  }, [fetchMetrics, fetchSlackStatus]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      fetchScheduled('', scheduledEmails.length > 0);
      fetchSent('', sentEmails.length > 0);
      return;
    }

    // Debounce server-side search fetch so in-memory filter is instantaneous without UI flash
    const timer = setTimeout(() => {
      fetchScheduled(searchQuery, true);
      fetchSent(searchQuery, true);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, fetchScheduled, fetchSent]);

  // Deterministic Wakeup: Auto-refresh only when the next scheduled email's run time arrives
  useEffect(() => {
    if (scheduledEmails.length === 0) return;

    const now = Date.now();
    let nextDueDelay = Infinity;

    for (const email of scheduledEmails) {
      if (email.scheduledAt) {
        const timeMs = new Date(email.scheduledAt).getTime();
        const diff = timeMs - now;
        if (diff > 0 && diff < nextDueDelay) {
          nextDueDelay = diff;
        } else if (diff <= 0) {
          nextDueDelay = 0;
          break;
        }
      }
    }

    if (nextDueDelay === 0) {
      // Job is due now; refresh once silently to pull updated status
      const timeout = setTimeout(() => {
        fetchScheduled(searchQuery, true);
        fetchSent(searchQuery, true);
        fetchMetrics();
      }, 1500);
      return () => clearTimeout(timeout);
    } else if (nextDueDelay !== Infinity && nextDueDelay < 3600000) {
      // Set exact timer (+1.5s buffer) for when the next scheduled email is due
      const timer = setTimeout(() => {
        fetchScheduled(searchQuery, true);
        fetchSent(searchQuery, true);
        fetchMetrics();
      }, nextDueDelay + 1500);

      return () => clearTimeout(timer);
    }
  }, [scheduledEmails, searchQuery, fetchScheduled, fetchSent, fetchMetrics]);

  const handleTabChange = (tab: 'scheduled' | 'sent') => {
    setActiveTab(tab);
    setViewMode('list');
    setSelectedEmail(null);
  };

  const handleSelectEmail = (email: EmailJob) => {
    setSelectedEmail(email);
    setViewMode('detail');
  };

  const handleCancelScheduled = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.cancelScheduledEmail(id);
      fetchScheduled(searchQuery, true);
      fetchSent(searchQuery, true);
      fetchMetrics();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to cancel email.');
    }
  };

  // Instant in-memory search filtering across subject, recipient, sender and body
  const filteredScheduled = scheduledEmails.filter((email) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      (email.subject && email.subject.toLowerCase().includes(q)) ||
      (email.recipientEmail && email.recipientEmail.toLowerCase().includes(q)) ||
      (email.senderEmail && email.senderEmail.toLowerCase().includes(q)) ||
      (email.body && email.body.toLowerCase().includes(q))
    );
  });

  const filteredSent = sentEmails.filter((email) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      (email.subject && email.subject.toLowerCase().includes(q)) ||
      (email.recipientEmail && email.recipientEmail.toLowerCase().includes(q)) ||
      (email.senderEmail && email.senderEmail.toLowerCase().includes(q)) ||
      (email.body && email.body.toLowerCase().includes(q))
    );
  });

  // The badge counter dynamically reflects the real-time count of emails at this moment without requiring a page reload
  const liveScheduledCount = searchQuery.trim() ? filteredScheduled.length : scheduledEmails.length;
  const liveSentCount = searchQuery.trim() ? filteredSent.length : sentEmails.length;

  return (
    <div className="flex h-screen bg-white overflow-hidden text-gray-900 font-['Inter',sans-serif]">
      {/* Left Navigation Sidebar (Figma Match) */}
      <Sidebar
        user={user}
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        onOpenCompose={() => {
          setViewMode('compose');
          setSelectedEmail(null);
        }}
        onOpenSlackModal={() => setIsSlackModalOpen(true)}
        onLogout={onLogout}
        scheduledCount={liveScheduledCount}
        sentCount={liveSentCount}
        slackConnected={slackConnected}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-white">
        {viewMode === 'compose' ? (
          <ComposeView
            onBack={() => setViewMode('list')}
            onSuccess={() => {
              setViewMode('list');
              setActiveTab('scheduled');
              fetchScheduled('');
              fetchMetrics();
            }}
            userEmail={user.email}
          />
        ) : viewMode === 'detail' && selectedEmail ? (
          <EmailDetailView
            email={selectedEmail}
            onBack={() => setViewMode('list')}
            onDelete={async (id) => {
              try {
                await api.cancelScheduledEmail(id);
              } catch (e) {}
              setViewMode('list');
              fetchScheduled(searchQuery);
              fetchSent(searchQuery);
              fetchMetrics();
            }}
          />
        ) : (
          <>
            {/* Top Search Bar (Figma Match) */}
            <HeaderSearch
              onSearch={(q) => {
                setSearchQuery(q);
              }}
              onRefresh={() => {
                fetchScheduled(searchQuery);
                fetchSent(searchQuery);
                fetchMetrics();
              }}
              loading={loading}
            />

            {/* List Table Area (Figma Match) */}
            <div className="flex-1 overflow-y-auto">
              {activeTab === 'scheduled' ? (
                <ScheduledList
                  emails={filteredScheduled}
                  loading={loading}
                  onSelectEmail={handleSelectEmail}
                  onCancel={handleCancelScheduled}
                />
              ) : (
                <SentList
                  emails={filteredSent}
                  loading={loading}
                  onSelectEmail={handleSelectEmail}
                />
              )}
            </div>
          </>
        )}
      </div>

      {/* Slack Integration Modal */}
      <SlackConnectModal
        isOpen={isSlackModalOpen}
        onClose={() => setIsSlackModalOpen(false)}
        connected={slackConnected}
        channel={slackChannel}
        onStatusChanged={fetchSlackStatus}
      />
    </div>
  );
};

export default Dashboard;
