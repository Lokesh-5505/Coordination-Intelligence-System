import { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  FileText,
  Mail,
  MessageSquare,
  Mic,
  PhoneCall,
  Send,
  Sparkles,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { ingestSignal } from '@/lib/api-custom';

interface SignalIngestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const SAMPLE_SIGNALS = [
  {
    label: '💬 WhatsApp Site Alert: Cantilever Slab Sleeve Clash',
    channel: 'WhatsApp',
    text: 'From Site Super Carlos Gomez: Urgent note for Rajesh (Structural) and Tariq (MEP). On Level 1 Great Room cantilever slab, the sanitary sleeves at Grid D-3 fall right into the primary post-tensioned tendon anchor plate TB-01. Tariq needs to offset sleeves 500mm south immediately before tomorrow morning rebar inspection or we will have severe structural clash on the slab!',
  },
  {
    label: '✉️ VistaVision Glazing Vendor: 12m Pocket Slider Risk',
    channel: 'Email',
    text: 'Liam Gallagher to Elena Rostova & David Chen: Our German glass fabrication plant is ready to cut the custom 12-meter slim motorized glass pocket panels for the Master Suite. However, we cannot lock the track extrusions until Rajesh signs off on the structural steel lintel deflection calculation (L/600 limit). If this approval slips past Wednesday, our sea-freight container will miss the Friday sailing, causing a 3-week delay to the villa envelope!',
  },
  {
    label: '📋 Owner Standup Note: Roman Travertine & Bathtub Load',
    channel: 'Meeting Minutes',
    text: 'Meeting note: Marcus Vance approved substituting honed cross-cut Roman Travertine for the infinity pool terrace to ensure an R11 non-slip rating. Marcus also requested verifying the freestanding marble bathtub point load over the ground floor formal living room ceiling before plumbing rough-in sign-off. Sophia to coordinate with Rajesh.',
  },
];

export function SignalIngestionModal({ isOpen, onClose, onSuccess }: SignalIngestionModalProps) {
  const [channel, setChannel] = useState('WhatsApp');
  const [rawText, setRawText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [parsedResult, setParsedResult] = useState<any>(null);
  const [committing, setCommitting] = useState(false);
  const [committed, setCommitted] = useState(false);

  if (!isOpen) return null;

  const handleAnalyze = async () => {
    if (!rawText.trim()) return;
    setAnalyzing(true);
    setParsedResult(null);
    try {
      const res = await ingestSignal(rawText, channel, false);
      setParsedResult(res);
    } catch (err: any) {
      alert(err.message || 'Failed to analyze signal');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCommit = async () => {
    if (!rawText.trim()) return;
    setCommitting(true);
    try {
      await ingestSignal(rawText, channel, true);
      setCommitted(true);
      setTimeout(() => {
        onSuccess();
        onClose();
        setCommitted(false);
        setParsedResult(null);
        setRawText('');
      }, 1200);
    } catch (err: any) {
      alert(err.message || 'Failed to commit change');
    } finally {
      setCommitting(false);
    }
  };

  const selectSample = (sample: (typeof SAMPLE_SIGNALS)[0]) => {
    setChannel(sample.channel);
    setRawText(sample.text);
    setParsedResult(null);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card signal-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div>
            <div className="status-tag">
              <Sparkles size={13} />
              <span>AI Coordination Pipeline</span>
            </div>
            <h2>Ingest Unstructured Project Signal</h2>
            <p className="modal-sub">
              Extract structured changes, impacted trades, and next actions from WhatsApp, emails, or field notes.
            </p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Quick Sample Presets */}
        <div className="signal-samples">
          <span className="eyebrow">Try sample real-world communication:</span>
          <div className="sample-chips">
            {SAMPLE_SIGNALS.map((s, i) => (
              <button
                key={i}
                type="button"
                className="sample-chip pressable"
                onClick={() => selectSample(s)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Channel Selector */}
        <div className="channel-selector">
          <span className="eyebrow">Source Channel:</span>
          <div className="channel-buttons">
            {[
              { id: 'WhatsApp', icon: MessageSquare },
              { id: 'Email', icon: Mail },
              { id: 'Meeting Minutes', icon: FileText },
              { id: 'Site Voice Note', icon: Mic },
            ].map(({ id, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setChannel(id)}
                className={`channel-btn ${channel === id ? 'active' : ''}`}
              >
                <Icon size={14} />
                <span>{id}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Input Textarea */}
        <div className="signal-input-box">
          <textarea
            rows={4}
            placeholder={`Paste raw message from ${channel} (e.g., chat thread, transcribed voice memo, email snippet)...`}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
          />
        </div>

        <div className="signal-actions">
          <button
            type="button"
            className="button button-primary"
            onClick={handleAnalyze}
            disabled={!rawText.trim() || analyzing || committing}
          >
            {analyzing ? (
              <>
                <Bot size={15} className="spin-icon" /> Analyzing with AI...
              </>
            ) : (
              <>
                <Sparkles size={15} /> Analyze &amp; Trace Ripple
              </>
            )}
          </button>
        </div>

        {/* Parsed Result Preview */}
        {parsedResult && (
          <div className="parsed-preview-box reveal">
            <div className="preview-top">
              <div className="preview-title">
                <span className="eyebrow">AI EXTRACTION · {parsedResult.discipline}</span>
                <h4>{parsedResult.title}</h4>
              </div>
              <span className={`pill pill-${parsedResult.severity === 'high' || parsedResult.severity === 'critical' ? 'danger' : 'amber'}`}>
                {parsedResult.severity.toUpperCase()} SEVERITY
              </span>
            </div>

            <div className="preview-grid">
              <div>
                <small>LEAD OWNER</small>
                <b>{parsedResult.lead}</b>
              </div>
              <div>
                <small>SOURCE</small>
                <b>{parsedResult.source}</b>
              </div>
              <div>
                <small>CONFIDENCE</small>
                <b className="teal-text">{parsedResult.confidence}</b>
              </div>
            </div>

            <div className="preview-stakeholders">
              <small>AFFECTED STAKEHOLDERS DETECTED</small>
              <div className="stakeholder-tags">
                {parsedResult.affectedStakeholders?.map((sh: string) => (
                  <span key={sh} className="stakeholder-tag">
                    <Users size={12} /> {sh}
                  </span>
                ))}
              </div>
            </div>

            <div className="preview-actions">
              <small>SUGGESTED NEXT ACTIONS</small>
              <ul>
                {parsedResult.proposedActions?.map((act: string, idx: number) => (
                  <li key={idx}>
                    <CheckCircle2 size={13} />
                    <span>{act}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="preview-commit-bar">
              <button
                type="button"
                className="button button-primary button-large"
                onClick={handleCommit}
                disabled={committing || committed}
              >
                {committed ? (
                  <>
                    <Check size={16} /> Ingested &amp; Alerts Dispatched!
                  </>
                ) : committing ? (
                  'Publishing to Project Memory...'
                ) : (
                  <>
                    <Zap size={16} /> 1-Click Publish to Project &amp; Notify Affected Leads
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
