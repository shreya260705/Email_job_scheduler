import React, { useState } from 'react';
import { User } from '../types';
import { Clock, Send, ChevronDown, LogOut, Slack, Activity, Plus } from 'lucide-react';

interface SidebarProps {
  user: User;
  activeTab: 'scheduled' | 'sent';
  setActiveTab: (tab: 'scheduled' | 'sent') => void;
  onOpenCompose: () => void;
  onOpenSlackModal: () => void;
  onLogout: () => void;
  scheduledCount: number;
  sentCount: number;
  slackConnected: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  user,
  activeTab,
  setActiveTab,
  onOpenCompose,
  onOpenSlackModal,
  onLogout,
  scheduledCount,
  sentCount,
  slackConnected,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <aside className="w-64 bg-white border-r border-[#F0F0F0] flex flex-col h-screen shrink-0 select-none">
      {/* ONB Logo */}
      <div className="px-6 pt-6 pb-4">
        <h1 className="text-3xl font-extrabold tracking-tighter text-black font-mono">
          ONB
        </h1>
      </div>

      {/* User Profile Card */}
      <div className="px-4 mb-4 relative">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-[#F9FAFB] transition-colors text-left"
        >
          <div className="flex items-center space-x-3 overflow-hidden">
            <img
              src={user.avatar || `https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face`}
              alt={user.name}
              className="h-10 w-10 rounded-full object-cover shrink-0 border border-gray-100"
            />
            <div className="overflow-hidden">
              <p className="text-sm font-semibold text-gray-900 leading-tight truncate">
                {user.name}
              </p>
              <p className="text-xs text-gray-400 leading-tight truncate">
                {user.email}
              </p>
            </div>
          </div>
          <ChevronDown className="h-4 w-4 text-gray-400 shrink-0 ml-1" />
        </button>

        {/* User Dropdown */}
        {dropdownOpen && (
          <div className="absolute top-full left-4 right-4 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg py-1.5 z-40">
            <button
              onClick={() => {
                setDropdownOpen(false);
                onOpenSlackModal();
              }}
              className="w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
            >
              <Slack className="h-3.5 w-3.5 text-emerald-600" />
              <span>{slackConnected ? 'Slack: Connected' : 'Connect Slack'}</span>
            </button>
            <a
              href="http://localhost:5000/admin/queues"
              target="_blank"
              rel="noreferrer"
              className="w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
            >
              <Activity className="h-3.5 w-3.5 text-purple-600" />
              <span>Bull-Board Monitor</span>
            </a>
            <div className="border-t border-gray-100 my-1" />
            <button
              onClick={() => {
                setDropdownOpen(false);
                onLogout();
              }}
              className="w-full px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50 flex items-center space-x-2"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </div>

      {/* Primary Compose Button (Figma Match: Outlined Green) */}
      <div className="px-4 mb-6">
        <button
          onClick={onOpenCompose}
          className="w-full py-2.5 px-4 rounded-xl border border-[#00A854] hover:bg-[#00A854]/5 text-[#00A854] font-medium text-sm flex items-center justify-center space-x-2 transition-colors"
        >
          <span>Compose</span>
        </button>
      </div>

      {/* CORE Navigation Section */}
      <div className="px-3 flex-1">
        <p className="px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
          CORE
        </p>

        <nav className="space-y-1">
          {/* Scheduled Item */}
          <button
            onClick={() => setActiveTab('scheduled')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-colors ${
              activeTab === 'scheduled'
                ? 'bg-[#E6F4EA] text-gray-900 font-semibold'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center space-x-3">
              <Clock className={`h-4 w-4 ${activeTab === 'scheduled' ? 'text-gray-900' : 'text-gray-500'}`} />
              <span>Scheduled</span>
            </div>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                activeTab === 'scheduled' ? 'text-gray-900 font-semibold' : 'text-gray-400'
              }`}
            >
              {scheduledCount}
            </span>
          </button>

          {/* Sent Item */}
          <button
            onClick={() => setActiveTab('sent')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-colors ${
              activeTab === 'sent'
                ? 'bg-[#E6F4EA] text-gray-900 font-semibold'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center space-x-3">
              <Send className={`h-4 w-4 ${activeTab === 'sent' ? 'text-gray-900' : 'text-gray-500'}`} />
              <span>Sent</span>
            </div>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                activeTab === 'sent' ? 'text-gray-900 font-semibold' : 'text-gray-400'
              }`}
            >
              {sentCount}
            </span>
          </button>
        </nav>
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
        <span>ReachInbox Onebox</span>
        <span className="flex items-center space-x-1">
          <span className={`h-2 w-2 rounded-full ${slackConnected ? 'bg-emerald-500' : 'bg-amber-400'}`} />
          <span>{slackConnected ? 'Slack Active' : 'Slack Off'}</span>
        </span>
      </div>
    </aside>
  );
};

export default Sidebar;
