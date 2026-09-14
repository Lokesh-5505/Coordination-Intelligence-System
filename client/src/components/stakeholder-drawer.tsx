import { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck2,
  Mail,
  MessageSquare,
  Phone,
  ShieldAlert,
  Target,
  Users,
  X,
} from 'lucide-react';

interface StakeholderDrawerProps {
  stakeholder: any | null;
  activities: any[];
  approvals: any[];
  onClose: () => void;
  onSelectActivity?: (actId: string) => void;
}

export function StakeholderDrawer({
  stakeholder,
  activities = [],
  approvals = [],
  onClose,
  onSelectActivity,
}: StakeholderDrawerProps) {
  const [activeTab, setActiveTab] = useState<'owned' | 'affected' | 'approvals'>('owned');

  if (!stakeholder) return null;

  // Activities owned by this stakeholder
  const ownedActivities = activities.filter(
    (a) =>
      a.owner?.toLowerCase() === stakeholder.name?.toLowerCase() ||
      a.ownerInitials === stakeholder.initials
  );

  // Activities that are blocked or impacted where this stakeholder is affected
  const affectedActivities = activities.filter(
    (a) =>
      a.discipline === stakeholder.discipline &&
      (a.status === 'blocked' || a.status === 'at-risk')
  );

  // Approvals assigned to or requested by this stakeholder
  const userApprovals = approvals.filter(
    (ap) =>
      ap.approver?.toLowerCase() === stakeholder.name?.toLowerCase() ||
      ap.requester?.toLowerCase() === stakeholder.name?.toLowerCase()
  );

  const getStatusPill = (status = '') => {
    const s = status.toLowerCase();
    let tone = 'slate';
    if (s.includes('block') || s.includes('reject')) tone = 'danger';
    else if (s.includes('risk') || s.includes('pending')) tone = 'amber';
    else if (s.includes('complete') || s.includes('approved')) tone = 'teal';
    return <span className={`pill pill-${tone}`}>{status}</span>;
  };

  const cleanPhone = (stakeholder.phone || '+15125550100').replace(/[^0-9]/g, '');
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=Hi%20${encodeURIComponent(
    stakeholder.name
  )},%20reaching%20out%20from%20The%20Grand%20Vista%20Villa%20Coordination%20regarding%20active%20workstreams.`;

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="stakeholder-drawer" onClick={(e) => e.stopPropagation()}>
        {/* Drawer Header */}
        <div className="drawer-header">
          <button className="icon-button" onClick={onClose} aria-label="Close drawer">
            <X size={18} />
          </button>
          <span className="eyebrow">STAKEHOLDER PROFILE</span>
        </div>

        {/* Profile Card */}
        <div className="drawer-profile">
          <div className="drawer-avatar-row">
            <span className="drawer-avatar">{stakeholder.initials || 'SH'}</span>
            <div className="drawer-name-block">
              <h3>{stakeholder.name}</h3>
              <span className="drawer-role-badge">{stakeholder.role}</span>
              <small className="drawer-company">
                <Building2 size={12} /> {stakeholder.company}
              </small>
            </div>
          </div>

          {/* Quick Contact Buttons */}
          <div className="drawer-contact-bar">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="button button-secondary button-sm"
              title="Chat on WhatsApp"
            >
              <MessageSquare size={14} className="teal-text" /> WhatsApp
            </a>
            <a
              href={`mailto:${stakeholder.email || 'contact@apex-cm.com'}`}
              className="button button-secondary button-sm"
              title="Send email"
            >
              <Mail size={14} /> Email
            </a>
            <a
              href={`tel:${stakeholder.phone || '+15125550100'}`}
              className="button button-secondary button-sm"
              title="Call phone"
            >
              <Phone size={14} /> Call
            </a>
          </div>

          {/* Metric Stats */}
          <div className="drawer-stats-row">
            <div className="drawer-stat">
              <b>{ownedActivities.length}</b>
              <small>Deliverables</small>
            </div>
            <div className="drawer-stat">
              <b className="amber-text">{affectedActivities.length}</b>
              <small>At-Risk / Blocked</small>
            </div>
            <div className="drawer-stat">
              <b className="teal-text">{userApprovals.length}</b>
              <small>Decisions</small>
            </div>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="drawer-tabs">
          <button
            className={activeTab === 'owned' ? 'active' : ''}
            onClick={() => setActiveTab('owned')}
          >
            Owned Work ({ownedActivities.length})
          </button>
          <button
            className={activeTab === 'affected' ? 'active' : ''}
            onClick={() => setActiveTab('affected')}
          >
            At-Risk Handoffs ({affectedActivities.length})
          </button>
          <button
            className={activeTab === 'approvals' ? 'active' : ''}
            onClick={() => setActiveTab('approvals')}
          >
            Approvals ({userApprovals.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="drawer-content">
          {activeTab === 'owned' && (
            <div className="drawer-list">
              {ownedActivities.length ? (
                ownedActivities.map((act) => (
                  <div
                    key={act.id}
                    className="drawer-item pressable"
                    onClick={() => onSelectActivity && onSelectActivity(act.id)}
                  >
                    <div className="item-main">
                      <b>{act.title}</b>
                      <div className="item-meta">
                        <small>{act.type}</small>
                        <span>·</span>
                        <small className="due-date">
                          <Clock size={11} /> {act.dueDate}
                        </small>
                      </div>
                      {act.blockedReason && (
                        <div className="item-block-note">
                          <AlertTriangle size={11} /> {act.blockedReason}
                        </div>
                      )}
                    </div>
                    {getStatusPill(act.status)}
                  </div>
                ))
              ) : (
                <div className="drawer-empty">
                  <Target size={22} />
                  <p>No active deliverables assigned to this stakeholder.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'affected' && (
            <div className="drawer-list">
              {affectedActivities.length ? (
                affectedActivities.map((act) => (
                  <div
                    key={act.id}
                    className="drawer-item pressable"
                    onClick={() => onSelectActivity && onSelectActivity(act.id)}
                  >
                    <div className="item-main">
                      <b>{act.title}</b>
                      <small className="danger-text">
                        <ShieldAlert size={12} /> Handoff impacted by upstream revision
                      </small>
                      {act.blockedReason && (
                        <p className="item-reason">{act.blockedReason}</p>
                      )}
                    </div>
                    {getStatusPill(act.status)}
                  </div>
                ))
              ) : (
                <div className="drawer-empty">
                  <CheckCircle2 size={22} className="teal-text" />
                  <p>All downstream handoffs are clear of blocking dependencies.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'approvals' && (
            <div className="drawer-list">
              {userApprovals.length ? (
                userApprovals.map((ap) => (
                  <div key={ap.id} className="drawer-item">
                    <div className="item-main">
                      <b>{ap.title}</b>
                      <small>
                        {ap.approver?.toLowerCase() === stakeholder.name?.toLowerCase()
                          ? `Decision required from ${stakeholder.name}`
                          : `Requested by ${stakeholder.name} · Approver: ${ap.approver}`}
                      </small>
                      <small className="due-date">Due: {ap.dueDate}</small>
                    </div>
                    {getStatusPill(ap.status)}
                  </div>
                ))
              ) : (
                <div className="drawer-empty">
                  <FileCheck2 size={22} />
                  <p>No pending approvals linked to this stakeholder.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
