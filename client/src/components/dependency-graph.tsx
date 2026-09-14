import { useState, useMemo } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  GitBranch,
  Layers,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Zap,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

interface DependencyGraphProps {
  activities: any[];
  dependencies: any[];
  onAddDependency?: () => void;
  onSelectActivity?: (activityId: string) => void;
}

export function DependencyGraph({
  activities = [],
  dependencies = [],
  onAddDependency,
  onSelectActivity,
}: DependencyGraphProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [filterDiscipline, setFilterDiscipline] = useState<string>('All');
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [blockedOnly, setBlockedOnly] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState('');

  // Disciplines available
  const disciplines = ['All', 'Civil', 'Structural', 'MEP', 'Facade', 'Interiors', 'Landscape', 'Safety'];

  // Dynamic topological layout algorithm based on dependency graph
  const { positions: nodePositions, maxRows } = useMemo(() => {
    // 1. Build dependency adjacency map
    const incoming: { [id: string]: string[] } = {};
    const outgoing: { [id: string]: string[] } = {};
    activities.forEach((act) => {
      incoming[act.id] = [];
      outgoing[act.id] = [];
    });

    dependencies.forEach((dep) => {
      if (incoming[dep.toId]) incoming[dep.toId].push(dep.fromId);
      if (outgoing[dep.fromId]) outgoing[dep.fromId].push(dep.toId);
    });

    // 2. Compute longest path / topological level for each node
    const levelMap: { [id: string]: number } = {};
    const computeLevel = (id: string, visited = new Set<string>()): number => {
      if (levelMap[id] !== undefined) return levelMap[id];
      if (visited.has(id)) return 0; // Cycle protection
      visited.add(id);

      const parents = incoming[id] || [];
      if (parents.length === 0) {
        levelMap[id] = 0;
        return 0;
      }

      let maxParentLevel = 0;
      for (const pId of parents) {
        maxParentLevel = Math.max(maxParentLevel, computeLevel(pId, new Set(visited)) + 1);
      }
      levelMap[id] = maxParentLevel;
      return maxParentLevel;
    };

    activities.forEach((act) => computeLevel(act.id));

    // 3. Partition activities into 4 stage buckets
    const stageBuckets: { [stage: number]: any[] } = { 0: [], 1: [], 2: [], 3: [] };
    const maxComputedLevel = Math.max(0, ...Object.values(levelMap));

    activities.forEach((act) => {
      const rawLevel = levelMap[act.id] ?? 0;
      let stageIdx = 0;
      if (maxComputedLevel <= 3) {
        stageIdx = Math.min(rawLevel, 3);
      } else {
        stageIdx = Math.min(3, Math.floor((rawLevel / (maxComputedLevel + 1)) * 4));
      }
      stageBuckets[stageIdx].push(act);
    });

    // 4. Compute pixel coordinates for each node
    const positions: { [id: string]: { x: number; y: number } } = {};
    const stageX = [50, 320, 590, 860];
    let calculatedMaxRows = 1;

    [0, 1, 2, 3].forEach((sIdx) => {
      const acts = stageBuckets[sIdx];
      if (acts.length > calculatedMaxRows) calculatedMaxRows = acts.length;
      const rowSpacing = 115;
      const startY = 55;

      acts.forEach((act, rowIdx) => {
        positions[act.id] = {
          x: stageX[sIdx],
          y: startY + rowIdx * rowSpacing,
        };
      });
    });

    return { positions, maxRows: calculatedMaxRows };
  }, [activities, dependencies]);

  // Filtered nodes
  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      if (filterDiscipline !== 'All' && act.discipline !== filterDiscipline) return false;
      if (criticalOnly && !act.criticalPath) return false;
      if (blockedOnly && act.status !== 'blocked' && act.status !== 'at-risk') return false;
      if (
        searchQuery &&
        !act.title?.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !act.owner?.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [activities, filterDiscipline, criticalOnly, blockedOnly, searchQuery]);

  // Active selected node: fallback to first activity if none selected or if selected was deleted
  const activeSelectedId = useMemo(() => {
    if (selectedNodeId && activities.some((a) => a.id === selectedNodeId)) {
      return selectedNodeId;
    }
    return activities[0]?.id || null;
  }, [selectedNodeId, activities]);

  const selectedActivity = activities.find((a) => a.id === activeSelectedId);

  // Upstream & Downstream dependencies for selected activity
  const upstreamDeps = dependencies.filter((d) => d.toId === activeSelectedId);
  const downstreamDeps = dependencies.filter((d) => d.fromId === activeSelectedId);

  const getStatusColor = (status = '') => {
    const s = status.toLowerCase();
    if (s.includes('block')) return { border: '#e63946', bg: 'rgba(230, 57, 70, 0.12)', text: '#e63946' };
    if (s.includes('risk') || s.includes('amber')) return { border: '#e76f51', bg: 'rgba(231, 111, 81, 0.12)', text: '#e76f51' };
    if (s.includes('complete') || s.includes('done')) return { border: '#2a9d8f', bg: 'rgba(42, 157, 143, 0.12)', text: '#2a9d8f' };
    if (s.includes('progress')) return { border: '#264653', bg: 'rgba(38, 70, 83, 0.12)', text: '#264653' };
    return { border: '#6c757d', bg: 'rgba(108, 117, 125, 0.1)', text: '#6c757d' };
  };

  const canvasWidth = 1120;
  const canvasHeight = Math.max(560, maxRows * 115 + 90);

  return (
    <div className="dependency-graph-container">
      {/* Controls Bar */}
      <div className="graph-toolbar">
        <div className="graph-filters">
          <div className="filter-pill-group">
            {disciplines.map((disc) => (
              <button
                key={disc}
                onClick={() => setFilterDiscipline(disc)}
                className={`filter-pill ${filterDiscipline === disc ? 'active' : ''}`}
                data-testid={`graph-filter-${disc.toLowerCase()}`}
              >
                {disc}
              </button>
            ))}
          </div>

          <div className="graph-toggles">
            <button
              onClick={() => setCriticalOnly(!criticalOnly)}
              className={`toggle-button ${criticalOnly ? 'toggle-active-danger' : ''}`}
              title="Highlight Critical Path across milestones"
              data-testid="toggle-critical-path"
            >
              <Zap size={14} />
              <span>Critical Path</span>
            </button>
            <button
              onClick={() => setBlockedOnly(!blockedOnly)}
              className={`toggle-button ${blockedOnly ? 'toggle-active-warning' : ''}`}
              title="Highlight Blocked and At-Risk handoffs"
              data-testid="toggle-blocked-flow"
            >
              <ShieldAlert size={14} />
              <span>Blocked Flow</span>
            </button>
          </div>
        </div>

        <div className="graph-actions">
          <div className="graph-search">
            <Search size={14} />
            <input
              type="text"
              placeholder="Search nodes or owners..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-graph-search"
            />
          </div>

          <div className="zoom-controls">
            <button onClick={() => setZoomLevel((z) => Math.max(0.7, z - 0.15))} title="Zoom Out" aria-label="Zoom Out">
              <ZoomOut size={15} />
            </button>
            <span className="zoom-text">{Math.round(zoomLevel * 100)}%</span>
            <button onClick={() => setZoomLevel((z) => Math.min(1.5, z + 0.15))} title="Zoom In" aria-label="Zoom In">
              <ZoomIn size={15} />
            </button>
            <button onClick={() => setZoomLevel(1)} title="Reset View" aria-label="Reset View">
              <RefreshCw size={13} />
            </button>
          </div>

          {onAddDependency && (
            <button className="button button-primary button-sm" onClick={onAddDependency} data-testid="button-graph-link-work">
              <Plus size={14} /> Link Work
            </button>
          )}
        </div>
      </div>

      {/* Main Canvas & Detail Split View */}
      <div className="graph-canvas-split">
        <div className="graph-canvas-viewport">
          <div
            className="graph-canvas-content"
            style={{
              transform: `scale(${zoomLevel})`,
              transformOrigin: 'top left',
              width: `${canvasWidth}px`,
              height: `${canvasHeight}px`,
              minWidth: `${canvasWidth}px`,
              minHeight: `${canvasHeight}px`,
            }}
          >
            {/* SVG Connector Lines */}
            <svg className="graph-svg-layer" width={canvasWidth} height={canvasHeight}>
              <defs>
                <marker
                  id="arrow-default"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 9 5 L 0 9 z" fill="#8d99ae" />
                </marker>
                <marker
                  id="arrow-blocks"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 9 5 L 0 9 z" fill="#e63946" />
                </marker>
                <marker
                  id="arrow-selected"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 9 5 L 0 9 z" fill="#e27742" />
                </marker>
              </defs>

              {dependencies.map((dep) => {
                const fromPos = nodePositions[dep.fromId];
                const toPos = nodePositions[dep.toId];
                if (!fromPos || !toPos) return null;

                const isConnectedToSelected =
                  dep.fromId === activeSelectedId || dep.toId === activeSelectedId;
                const isBlocking = dep.type === 'blocks' || dep.status === 'at-risk';

                // Node box dimensions: width = 210, height = 80
                const startX = fromPos.x + 210;
                const startY = fromPos.y + 40;
                const endX = toPos.x;
                const endY = toPos.y + 40;
                const deltaX = Math.max(40, Math.abs(endX - startX) * 0.5);

                const pathData = `M ${startX} ${startY} C ${startX + deltaX} ${startY}, ${
                  endX - deltaX
                } ${endY}, ${endX} ${endY}`;

                let strokeColor = '#b0b8c1';
                let strokeWidth = 1.8;
                let strokeDash = undefined;
                let markerId = 'arrow-default';

                if (isBlocking) {
                  strokeColor = '#e63946';
                  strokeWidth = 2.2;
                  strokeDash = '4 4';
                  markerId = 'arrow-blocks';
                }
                if (isConnectedToSelected) {
                  strokeColor = '#e27742';
                  strokeWidth = 2.6;
                  markerId = 'arrow-selected';
                }

                return (
                  <g key={dep.id} className="graph-edge-group">
                    <path
                      d={pathData}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      strokeDasharray={strokeDash}
                      markerEnd={`url(#${markerId})`}
                      className={isBlocking ? 'pulse-edge' : ''}
                    />
                    {/* Edge Type Badge at midpoint */}
                    <text
                      x={(startX + endX) / 2}
                      y={(startY + endY) / 2 - 8}
                      className="edge-label"
                      textAnchor="middle"
                      fill={isConnectedToSelected ? '#e27742' : '#718096'}
                    >
                      {dep.type}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Stage Column Labels */}
            <div className="stage-guides">
              <span style={{ left: '50px' }}>STAGE 01 · SITE & SUBSTRUCTURE</span>
              <span style={{ left: '320px' }}>STAGE 02 · SUPERSTRUCTURE & PODIUM</span>
              <span style={{ left: '590px' }}>STAGE 03 · SERVICES & ENVELOPE</span>
              <span style={{ left: '860px' }}>STAGE 04 · FINISHES & RELEASE</span>
            </div>

            {/* HTML Interactive Node Cards */}
            {filteredActivities.map((act) => {
              const pos = nodePositions[act.id] || { x: 50, y: 50 };
              const isSelected = act.id === activeSelectedId;
              const statusColor = getStatusColor(act.status);

              return (
                <div
                  key={act.id}
                  className={`graph-node-card pressable ${isSelected ? 'node-selected' : ''} ${
                    act.criticalPath ? 'node-critical' : ''
                  }`}
                  style={{
                    left: `${pos.x}px`,
                    top: `${pos.y}px`,
                    borderColor: isSelected ? '#e27742' : statusColor.border,
                  }}
                  onClick={() => {
                    setSelectedNodeId(act.id);
                    if (onSelectActivity) onSelectActivity(act.id);
                  }}
                  data-testid={`graph-node-${act.id}`}
                >
                  <div className="node-card-header">
                    <span className="node-discipline-badge">{act.discipline || act.type}</span>
                    <span
                      className="node-status-dot"
                      style={{ backgroundColor: statusColor.border }}
                      title={act.status}
                    />
                  </div>

                  <div className="node-card-body">
                    <b className="node-title" title={act.title}>
                      {act.title}
                    </b>
                    {act.location && <small className="node-location">{act.location}</small>}
                  </div>

                  <div className="node-card-footer">
                    <div className="node-owner">
                      <span className="node-avatar">{act.ownerInitials || act.owner?.slice(0, 2)?.toUpperCase() || 'MS'}</span>
                      <small>{act.owner?.split(' ')[0]}</small>
                    </div>
                    <span className="node-due">
                      <Clock size={11} /> {act.dueDate}
                    </span>
                  </div>

                  {act.status === 'blocked' && (
                    <div className="node-blocked-flag">
                      <AlertTriangle size={11} /> Blocked
                    </div>
                  )}
                  {act.criticalPath && <span className="node-critical-badge">CP</span>}
                </div>
              );
            })}

            {filteredActivities.length === 0 && (
              <div style={{ padding: '60px 40px', textAlign: 'center', color: '#718096' }}>
                <p>No activities match your current filter criteria.</p>
              </div>
            )}
          </div>
        </div>

        {/* Node Detail Inspector Sidebar */}
        <aside className="graph-inspector-panel">
          {selectedActivity ? (
            <div className="inspector-content">
              <div className="inspector-header">
                <span className="eyebrow">{selectedActivity.discipline || 'Package Item'}</span>
                <h3>{selectedActivity.title}</h3>
                <div className="inspector-tags">
                  <span
                    className="pill"
                    style={{
                      backgroundColor: getStatusColor(selectedActivity.status).bg,
                      color: getStatusColor(selectedActivity.status).text,
                    }}
                  >
                    {selectedActivity.status}
                  </span>
                  {selectedActivity.criticalPath && (
                    <span className="pill pill-danger">Critical Path</span>
                  )}
                </div>
              </div>

              <div className="inspector-meta-grid">
                <div>
                  <small>RESPONSIBLE OWNER</small>
                  <b>{selectedActivity.owner}</b>
                </div>
                <div>
                  <small>DUE DATE</small>
                  <b>{selectedActivity.dueDate}</b>
                </div>
                <div>
                  <small>LOCATION / ZONE</small>
                  <b>{selectedActivity.location || 'Site Location'}</b>
                </div>
                <div>
                  <small>TYPE</small>
                  <b>{selectedActivity.type}</b>
                </div>
              </div>

              {selectedActivity.blockedReason && (
                <div className="inspector-alert-box">
                  <ShieldAlert size={16} />
                  <div>
                    <b>Handoff Bottleneck</b>
                    <p>{selectedActivity.blockedReason}</p>
                  </div>
                </div>
              )}

              {/* Upstream Prerequisites */}
              <div className="inspector-connections">
                <div className="connection-heading">
                  <span className="eyebrow">Waiting On (Prerequisites)</span>
                  <span className="count-badge">{upstreamDeps.length}</span>
                </div>
                {upstreamDeps.length ? (
                  upstreamDeps.map((dep) => (
                    <div
                      key={dep.id}
                      className="connection-item pressable"
                      onClick={() => setSelectedNodeId(dep.fromId)}
                    >
                      <div className="connection-dot dot-upstream" />
                      <div>
                        <b>{dep.fromTitle}</b>
                        <small>Relationship: {dep.type}</small>
                      </div>
                      <ArrowRight size={13} />
                    </div>
                  ))
                ) : (
                  <p className="no-conn-text">No incoming dependencies recorded.</p>
                )}
              </div>

              {/* Downstream Affected Work */}
              <div className="inspector-connections">
                <div className="connection-heading">
                  <span className="eyebrow">Directly Affects (Downstream)</span>
                  <span className="count-badge">{downstreamDeps.length}</span>
                </div>
                {downstreamDeps.length ? (
                  downstreamDeps.map((dep) => (
                    <div
                      key={dep.id}
                      className="connection-item pressable"
                      onClick={() => setSelectedNodeId(dep.toId)}
                    >
                      <div className="connection-dot dot-downstream" />
                      <div>
                        <b>{dep.toTitle}</b>
                        <small>Relationship: {dep.type}</small>
                      </div>
                      <ArrowRight size={13} />
                    </div>
                  ))
                ) : (
                  <p className="no-conn-text">Terminal deliverable (no downstream blocks).</p>
                )}
              </div>

              <div className="inspector-footer">
                {onAddDependency && (
                  <button className="button button-secondary button-sm" onClick={onAddDependency} data-testid="button-inspector-link">
                    <Plus size={14} /> Link new dependency
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="inspector-empty">
              <GitBranch size={28} />
              <b>Select an Activity</b>
              <p>Click any node in the graph to inspect upstream prerequisites and downstream ripple.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
