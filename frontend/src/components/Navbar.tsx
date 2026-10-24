import React from 'react';
import { User } from '../types';
import { Mail, Slack, ExternalLink, LogOut, Activity } from 'lucide-react';

interface NavbarProps {
  user: User;
  activeTab: 'scheduled' | 'sent';
  setActiveTab: (tab: 'scheduled' | 'sent') => void;
  onOpenCompose: () => void;
  onOpenSlackModal: () => void;
  onLogout: () => void;
  slackConnected: boolean;
  slackChannel?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  activeTab,
  setActiveTab,
  onOpenCompose,
  onOpenSlackModal,
  onLogout,
  slackConnected,
  slackChannel,
}) => {
  return (
    <header className="border-b border-[#1F2430] bg-[#12161F]/90 backdrop-blur sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand / Logo */}
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Mail className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg text-white tracking-tight">ReachInbox</span>
                <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  Scheduler
                </span>
              </div>
              <p className="text-[11px] text-gray-400">by Outbox Labs</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center space-x-1 pl-4 border-l border-gray-800">
            <button
              onClick={() => setActiveTab('scheduled')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'scheduled'
                  ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
              }`}
            >
              Scheduled Emails
            </button>
            <button
              onClick={() => setActiveTab('sent')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'sent'
                  ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
              }`}
            >
              Sent Emails
            </button>
            <a
              href="http://localhost:5000/admin/queues"
              target="_blank"
              rel="noreferrer"
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 transition-all"
            >
              <Activity className="h-3.5 w-3.5 text-purple-400" />
              <span>Bull-Board</span>
              <ExternalLink className="h-3 w-3 opacity-60" />
            </a>
          </nav>
        </div>

        {/* Right Actions */}
        <div className="flex items-center space-x-4">
          {/* Slack Integration Status Button */}
          <button
            onClick={onOpenSlackModal}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              slackConnected
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
            }`}
          >
            <Slack className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">
              {slackConnected ? `Slack: ${slackChannel || 'Connected'}` : 'Connect Slack'}
            </span>
          </button>

          {/* Primary Compose Button */}
          <button
            onClick={onOpenCompose}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm shadow-md shadow-indigo-600/30 transition-all"
          >
            <Mail className="h-4 w-4" />
            <span>Compose Email</span>
          </button>

          {/* User Profile & Logout */}
          <div className="flex items-center space-x-3 pl-2 border-l border-gray-800">
            <img
              src={user.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${user.name}`}
              alt={user.name}
              className="h-8 w-8 rounded-full border border-indigo-500/30 bg-gray-800 object-cover"
            />
            <div className="hidden lg:block text-left">
              <p className="text-xs font-semibold text-white leading-tight">{user.name}</p>
              <p className="text-[11px] text-gray-400 leading-tight truncate max-w-[140px]">{user.email}</p>
            </div>
            <button
              onClick={onLogout}
              title="Logout"
              className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
