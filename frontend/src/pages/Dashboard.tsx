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
    fetchScheduled(searchQuery);
    fetchSent(searchQuery);
  }, [searchQuery, fetchMetrics, fetchSlackStatus, fetchScheduled, fetchSent]);

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
      fetchScheduled(searchQuery);
      fetchMetrics();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to cancel email.');
    }
  };

  const liveScheduledCount = metrics?.stats.scheduled ?? scheduledEmails.length;
  const liveSentCount = metrics?.stats.sent !== undefined
    ? Math.max(metrics.stats.sent, sentEmails.length)
    : sentEmails.length;

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
                if (activeTab === 'scheduled') fetchScheduled(q);
                else fetchSent(q);
              }}
              onRefresh={() => {
                if (activeTab === 'scheduled') fetchScheduled(searchQuery);
                else fetchSent(searchQuery);
                fetchMetrics();
              }}
              loading={loading}
            />

            {/* List Table Area (Figma Match) */}
            <div className="flex-1 overflow-y-auto">
              {activeTab === 'scheduled' ? (
                <ScheduledList
                  emails={scheduledEmails}
                  loading={loading}
                  onSelectEmail={handleSelectEmail}
                  onCancel={handleCancelScheduled}
                />
              ) : (
                <SentList
                  emails={sentEmails}
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
