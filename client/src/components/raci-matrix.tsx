import { useState } from 'react';
import { Check, Filter, HelpCircle, Info, Search, ShieldCheck, Users } from 'lucide-react';

interface RaciMatrixProps {
  stakeholders: any[];
  onSelectStakeholder?: (stakeholderId: string) => void;
  currentUserRole?: string;
  currentUserName?: string;
}

interface PackageItem {
  id: string;
  name: string;
  discipline: string;
  leadOwner: string;
  assignments: { [stakeholderId: string]: 'R' | 'A' | 'C' | 'I' };
}

const DEFAULT_PACKAGES: PackageItem[] = [
  {
    id: 'pkg-1',
    name: 'Subterranean Foundation & Deep Waterproofing',
    discipline: 'Civil',
    leadOwner: 'Carlos Gomez',
    assignments: {
      david: 'A',
      marcus: 'I',
      elena: 'C',
      rajesh: 'C',
      sophia: 'I',
      tariq: 'C',
      carlos: 'R',
      liam: 'I',
      sunita: 'A',
    },
  },
  {
    id: 'pkg-2',
    name: 'Cantilever Superstructure & Post-Tensioned Slabs',
    discipline: 'Structural',
    leadOwner: 'Rajesh Patel',
    assignments: {
      david: 'A',
      marcus: 'I',
      elena: 'C',
      rajesh: 'R',
      sophia: 'I',
      tariq: 'C',
      carlos: 'R',
      liam: 'I',
      sunita: 'C',
    },
  },
  {
    id: 'pkg-3',
    name: 'Motorized Slimline Glazing & Pocket Sliders',
    discipline: 'Facade',
    leadOwner: 'Elena Rostova',
    assignments: {
      david: 'A',
      marcus: 'C',
      elena: 'R',
      rajesh: 'C',
      sophia: 'C',
      tariq: 'I',
      carlos: 'C',
      liam: 'I',
      sunita: 'I',
    },
  },
  {
    id: 'pkg-4',
    name: 'Geothermal Heat Pump & Hydronic Radiant Heating',
    discipline: 'MEP',
    leadOwner: 'Tariq Mansoor',
    assignments: {
      david: 'A',
      marcus: 'A',
      elena: 'C',
      rajesh: 'C',
      sophia: 'I',
      tariq: 'R',
      carlos: 'C',
      liam: 'I',
      sunita: 'I',
    },
  },
  {
    id: 'pkg-5',
    name: 'Italian Navona Travertine Deck & Infinity Pool',
    discipline: 'Civil',
    leadOwner: 'Liam O\'Connor',
    assignments: {
      david: 'A',
      marcus: 'A',
      elena: 'C',
      rajesh: 'C',
      sophia: 'C',
      tariq: 'C',
      carlos: 'R',
      liam: 'R',
      sunita: 'I',
    },
  },
  {
    id: 'pkg-6',
    name: 'Bespoke Millwork & Italian Kitchen Joinery',
    discipline: 'Interiors',
    leadOwner: 'Sophia Laurent',
    assignments: {
      david: 'A',
      marcus: 'A',
      elena: 'C',
      rajesh: 'I',
      sophia: 'R',
      tariq: 'C',
      carlos: 'C',
      liam: 'I',
      sunita: 'I',
    },
  },
  {
    id: 'pkg-7',
    name: 'KNX Home Automation & Architectural Lighting',
    discipline: 'MEP',
    leadOwner: 'Tariq Mansoor',
    assignments: {
      david: 'A',
      marcus: 'C',
      elena: 'C',
      rajesh: 'I',
      sophia: 'C',
      tariq: 'R',
      carlos: 'C',
      liam: 'I',
      sunita: 'I',
    },
  },
  {
    id: 'pkg-8',
    name: 'Permitting, Hillside Drainage & Code Sign-Off',
    discipline: 'Civil',
    leadOwner: 'Sunita Rao',
    assignments: {
      david: 'A',
      marcus: 'I',
      elena: 'C',
      rajesh: 'C',
      sophia: 'I',
      tariq: 'I',
      carlos: 'C',
      liam: 'C',
      sunita: 'R',
    },
  },
];

export function RaciMatrix({
  stakeholders = [],
  onSelectStakeholder,
  currentUserRole,
  currentUserName,
}: RaciMatrixProps) {
  const [filterDiscipline, setFilterDiscipline] = useState('All');
  const [search, setSearch] = useState('');
  const [_hoveredCell, setHoveredCell] = useState<{ pkgId: string; shId: string } | null>(null);

  const displayStakeholders = stakeholders.slice(0, 8); // Top key stakeholders

  const isMyStakeholder = (sh: any) => {
    if (!currentUserRole && !currentUserName) return false;
    const sName = (sh.name || "").toLowerCase();
    const sRole = (sh.role || "").toLowerCase();
    const sDisc = (sh.discipline || "").toLowerCase();
    const cRole = (currentUserRole || "").toLowerCase();
    const cName = (currentUserName || "").toLowerCase();

    if (cName && sName.includes(cName)) return true;
    if (cRole === "admin" && (sRole.includes("delivery") || sRole.includes("admin") || sName.includes("david"))) return true;
    if (cRole === "owner" && (sRole.includes("owner") || sRole.includes("client") || sName.includes("marcus"))) return true;
    if (cRole === "engineer" && (sRole.includes("engineer") || sDisc.includes("structural") || sName.includes("rajesh"))) return true;
    if (cRole === "architect" && (sRole.includes("architect") || sDisc.includes("architecture") || sName.includes("elena"))) return true;
    if (cRole === "contractor" && (sRole.includes("contractor") || sDisc.includes("construction") || sName.includes("carlos"))) return true;
    if (cRole === "interior" && (sRole.includes("interior") || sName.includes("sophia"))) return true;
    if (cRole === "mep" && (sRole.includes("mep") || sName.includes("tariq"))) return true;

    return false;
  };

  const getStakeholderAssignment = (pkg: PackageItem, sh: any) => {
    const firstName = sh.name ? sh.name.split(" ")[0].toLowerCase() : "";
    return (
      pkg.assignments[sh.id] ||
      (firstName && pkg.assignments[firstName]) ||
      (sh.raci && sh.raci[pkg.name]) ||
      undefined
    );
  };

  const filteredPackages = DEFAULT_PACKAGES.filter((pkg) => {
    if (filterDiscipline !== 'All' && pkg.discipline !== filterDiscipline) return false;
    if (search && !pkg.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const getRaciBadge = (role?: 'R' | 'A' | 'C' | 'I') => {
    switch (role) {
      case 'R':
        return <span className="raci-cell raci-r" title="Responsible (Completes the work)">R</span>;
      case 'A':
        return <span className="raci-cell raci-a" title="Accountable (Final approval & decision)">A</span>;
      case 'C':
        return <span className="raci-cell raci-c" title="Consulted (Provides two-way input)">C</span>;
      case 'I':
        return <span className="raci-cell raci-i" title="Informed (Kept updated on changes)">I</span>;
      default:
        return <span className="raci-cell raci-empty">—</span>;
    }
  };

  return (
    <div className="raci-matrix-wrapper">
      {/* Legend & Stats Header */}
      <div className="raci-top-banner">
        <div className="raci-legend">
          <span className="legend-item">
            <span className="raci-cell raci-r">R</span>
            <b>Responsible</b> (Executes the task)
          </span>
          <span className="legend-item">
            <span className="raci-cell raci-a">A</span>
            <b>Accountable</b> (Final approval / owner)
          </span>
          <span className="legend-item">
            <span className="raci-cell raci-c">C</span>
            <b>Consulted</b> (Input & coordination)
          </span>
          <span className="legend-item">
            <span className="raci-cell raci-i">I</span>
            <b>Informed</b> (Kept in the loop)
          </span>
        </div>

        <div className="raci-toolbar">
          <div className="search-field raci-search">
            <Search size={14} />
            <input
              placeholder="Search work packages..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="filter-pill-group">
            {['All', 'Structural', 'MEP', 'Facade', 'Interiors', 'Civil'].map((d) => (
              <button
                key={d}
                onClick={() => setFilterDiscipline(d)}
                className={`filter-pill ${filterDiscipline === d ? 'active' : ''}`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* RACI Grid Table */}
      <div className="raci-table-container">
        <table className="raci-table">
          <thead>
            <tr>
              <th className="th-package">Work Package / Deliverable</th>
              <th className="th-lead">Lead Discipline</th>
              {displayStakeholders.map((sh) => {
                const isMe = isMyStakeholder(sh);
                return (
                  <th
                    key={sh.id}
                    className={`th-stakeholder pressable ${isMe ? 'my-role-col' : ''}`}
                    onClick={() => onSelectStakeholder && onSelectStakeholder(sh.id)}
                    title={`${sh.name} (${sh.role}) ${isMe ? '· Your Active Role' : ''}`}
                  >
                    <div className="th-sh-content">
                      <span className={`sh-avatar ${isMe ? 'my-avatar' : ''}`}>{sh.initials}</span>
                      <b className="sh-name">
                        {sh.name.split(' ')[0]}
                        {isMe && <span className="my-role-pill">YOU</span>}
                      </b>
                      <small className="sh-role">{sh.discipline || sh.role?.split(' ')[0]}</small>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {filteredPackages.map((pkg) => (
              <tr key={pkg.id} className="raci-row">
                <td className="td-package">
                  <div className="pkg-info">
                    <b>{pkg.name}</b>
                    <small>{pkg.discipline} Package</small>
                  </div>
                </td>
                <td className="td-lead">
                  <span className="lead-badge">{pkg.leadOwner}</span>
                </td>
                {displayStakeholders.map((sh) => {
                  const isMe = isMyStakeholder(sh);
                  const role = getStakeholderAssignment(pkg, sh);
                  return (
                    <td
                      key={sh.id}
                      className={`td-raci-cell ${isMe ? 'my-role-cell' : ''}`}
                      onMouseEnter={() => setHoveredCell({ pkgId: pkg.id, shId: sh.id })}
                      onMouseLeave={() => setHoveredCell(null)}
                    >
                      {getRaciBadge(role)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="raci-footer-note">
        <Info size={14} />
        <span>
          Every project change triggers automatic alert routing based on this RACI coverage: Responsible and Accountable members receive direct action items; Consulted members receive review requests; Informed members receive digest updates.
        </span>
      </div>
    </div>
  );
}
