import "dotenv/config";
import { Router } from "express";
import fs from "fs";
import path from "path";
import { hashPassword, comparePassword, signToken } from "../lib/auth";
import { authMiddleware, invalidateUserSession } from "../middlewares/authMiddleware";
import {
  neonGetProject,
  neonUpsertProject,
  neonGetAllUsers,
  neonGetUserByEmail,
  neonGetUserById,
  neonUpsertUser,
  neonGetProjectStore,
  neonSaveFullProjectStore,
  ensureUUID,
} from "../db/neon";

const router = Router();

// ─── Fast In-Memory Database & Seed State ─────────────────────────────────────
// Guaranteed sub-millisecond response time without hanging on remote network timeouts
export interface VillaProjectStore {
  project: any;
  users: any[];
  stakeholders: any[];
  activities: any[];
  dependencies: any[];
  changes: any[];
  actions: any[];
  approvals: any[];
  alerts: any[];
  memory: any[];
}

export const VILLA_PROJECT_ID = "11111111-2222-3333-4444-555555555555";
export const DEMO_USER_ID = "00000000-1111-2222-3333-444444444444";

export function createInitialVillaStore(): VillaProjectStore {
  return {
    project: {
      id: VILLA_PROJECT_ID,
      name: "The Grand Vista Luxury Villa",
      description:
        "14,500 sq ft contemporary architectural villa featuring multi-level cantilevered living spaces, panoramic motorized glazing, infinity pool, subterranean wine cellar & private theatre, smart home automation, bespoke Italian travertine & teak finishes, and geothermal HVAC.",
      location: "42 Crestline Ridge, Hill Country Estates",
      phase: "Superstructure & MEP Rough-In",
      status: "Attention required",
      progress: 54,
      ownerId: DEMO_USER_ID,
      isDemo: true,
      updatedAt: new Date().toISOString(),
    },
    users: [
      {
        id: DEMO_USER_ID,
        name: "David Chen",
        email: "david.chen@apex-cm.com",
        passwordHash: "$2a$10$w3aJ...", // demo
        role: "admin",
        projectId: VILLA_PROJECT_ID,
      },
    ],
    stakeholders: [
      {
        id: "stk-1",
        projectId: VILLA_PROJECT_ID,
        name: "David Chen",
        initials: "DC",
        role: "Project Delivery Manager",
        discipline: "Project Management",
        company: "Apex Construction Management",
        email: "david.chen@apex-cm.com",
        phone: "+1 (512) 555-0101",
        whatsapp: "+15125550101",
        status: "online",
        ownedCount: 3,
        affectedByCount: 4,
        raci: {
          "Subterranean Foundation & Retaining Walls": "A",
          "Cantilevered Superstructure & Slabs": "A",
          "Motorized Slim-Profile Glazing": "A",
          "Geothermal HVAC & Hydronic Systems": "A",
          "Italian Travertine & Architectural Finishes": "A",
          "Smart Home KNX/Lutron Automation": "A",
          "Infinity Edge Pool & Hydraulics": "A",
          "Terraced Landscaping & Courtyards": "A",
        },
      },
      {
        id: "stk-2",
        projectId: VILLA_PROJECT_ID,
        name: "Marcus Vance",
        initials: "MV",
        role: "Client / Property Owner",
        discipline: "Client",
        company: "Vance Holdings LLC",
        email: "marcus.vance@vanceholdings.com",
        phone: "+1 (512) 555-0102",
        whatsapp: "+15125550102",
        status: "online",
        ownedCount: 1,
        affectedByCount: 5,
        raci: {
          "Subterranean Foundation & Retaining Walls": "I",
          "Cantilevered Superstructure & Slabs": "I",
          "Motorized Slim-Profile Glazing": "C",
          "Geothermal HVAC & Hydronic Systems": "I",
          "Italian Travertine & Architectural Finishes": "A",
          "Smart Home KNX/Lutron Automation": "C",
          "Infinity Edge Pool & Hydraulics": "C",
          "Terraced Landscaping & Courtyards": "C",
        },
      },
      {
        id: "stk-3",
        projectId: VILLA_PROJECT_ID,
        name: "Elena Rostova",
        initials: "ER",
        role: "Principal Architect & Design Lead",
        discipline: "Architecture",
        company: "Studio Rostova Architecture",
        email: "elena.rostova@studiorostova.com",
        phone: "+1 (512) 555-0103",
        whatsapp: "+15125550103",
        status: "in-meeting",
        ownedCount: 4,
        affectedByCount: 6,
        raci: {
          "Subterranean Foundation & Retaining Walls": "C",
          "Cantilevered Superstructure & Slabs": "C",
          "Motorized Slim-Profile Glazing": "R",
          "Geothermal HVAC & Hydronic Systems": "C",
          "Italian Travertine & Architectural Finishes": "R",
          "Smart Home KNX/Lutron Automation": "C",
          "Infinity Edge Pool & Hydraulics": "C",
          "Terraced Landscaping & Courtyards": "C",
        },
      },
      {
        id: "stk-4",
        projectId: VILLA_PROJECT_ID,
        name: "Rajesh Patel",
        initials: "RP",
        role: "Lead Structural Engineer",
        discipline: "Structural",
        company: "Patel & Partners Engineering",
        email: "rajesh.patel@patelengineers.com",
        phone: "+1 (512) 555-0104",
        whatsapp: "+15125550104",
        status: "on-site",
        ownedCount: 3,
        affectedByCount: 4,
        raci: {
          "Subterranean Foundation & Retaining Walls": "R",
          "Cantilevered Superstructure & Slabs": "R",
          "Motorized Slim-Profile Glazing": "C",
          "Geothermal HVAC & Hydronic Systems": "C",
          "Italian Travertine & Architectural Finishes": "I",
          "Smart Home KNX/Lutron Automation": "I",
          "Infinity Edge Pool & Hydraulics": "R",
          "Terraced Landscaping & Courtyards": "I",
        },
      },
      {
        id: "stk-5",
        projectId: VILLA_PROJECT_ID,
        name: "Sophia Lorenzi",
        initials: "SL",
        role: "Interior Architect & Finishes Specialist",
        discipline: "Interiors",
        company: "Lorenzi Atelier Milan",
        email: "sophia.lorenzi@lorenziatelier.com",
        phone: "+1 (512) 555-0105",
        whatsapp: "+15125550105",
        status: "online",
        ownedCount: 3,
        affectedByCount: 3,
        raci: {
          "Subterranean Foundation & Retaining Walls": "I",
          "Cantilevered Superstructure & Slabs": "I",
          "Motorized Slim-Profile Glazing": "C",
          "Geothermal HVAC & Hydronic Systems": "C",
          "Italian Travertine & Architectural Finishes": "R",
          "Smart Home KNX/Lutron Automation": "C",
          "Infinity Edge Pool & Hydraulics": "C",
          "Terraced Landscaping & Courtyards": "I",
        },
      },
      {
        id: "stk-6",
        projectId: VILLA_PROJECT_ID,
        name: "Tariq Al-Mansoor",
        initials: "TA",
        role: "MEP & Geothermal Systems Lead",
        discipline: "MEP",
        company: "SmartSystems Engineering",
        email: "tariq.almansoor@smartsystems-eng.com",
        phone: "+1 (512) 555-0106",
        whatsapp: "+15125550106",
        status: "online",
        ownedCount: 3,
        affectedByCount: 5,
        raci: {
          "Subterranean Foundation & Retaining Walls": "I",
          "Cantilevered Superstructure & Slabs": "C",
          "Motorized Slim-Profile Glazing": "I",
          "Geothermal HVAC & Hydronic Systems": "R",
          "Italian Travertine & Architectural Finishes": "C",
          "Smart Home KNX/Lutron Automation": "R",
          "Infinity Edge Pool & Hydraulics": "C",
          "Terraced Landscaping & Courtyards": "C",
        },
      },
      {
        id: "stk-7",
        projectId: VILLA_PROJECT_ID,
        name: "Carlos Gomez",
        initials: "CG",
        role: "General Site Superintendent",
        discipline: "Site Operations",
        company: "Apex BuildCorp",
        email: "carlos.gomez@apexbuildcorp.com",
        phone: "+1 (512) 555-0107",
        whatsapp: "+15125550107",
        status: "on-site",
        ownedCount: 4,
        affectedByCount: 6,
        raci: {
          "Subterranean Foundation & Retaining Walls": "R",
          "Cantilevered Superstructure & Slabs": "R",
          "Motorized Slim-Profile Glazing": "R",
          "Geothermal HVAC & Hydronic Systems": "R",
          "Italian Travertine & Architectural Finishes": "R",
          "Smart Home KNX/Lutron Automation": "R",
          "Infinity Edge Pool & Hydraulics": "R",
          "Terraced Landscaping & Courtyards": "R",
        },
      },
      {
        id: "stk-8",
        projectId: VILLA_PROJECT_ID,
        name: "Liam Gallagher",
        initials: "LG",
        role: "Bespoke Glazing & Facade Specialist",
        discipline: "Facade",
        company: "VistaVision Architectural Glass",
        email: "liam.gallagher@vistavisionglass.com",
        phone: "+1 (512) 555-0108",
        whatsapp: "+15125550108",
        status: "offline",
        ownedCount: 2,
        affectedByCount: 4,
        raci: {
          "Subterranean Foundation & Retaining Walls": "I",
          "Cantilevered Superstructure & Slabs": "C",
          "Motorized Slim-Profile Glazing": "R",
          "Geothermal HVAC & Hydronic Systems": "I",
          "Italian Travertine & Architectural Finishes": "I",
          "Smart Home KNX/Lutron Automation": "I",
          "Infinity Edge Pool & Hydraulics": "I",
          "Terraced Landscaping & Courtyards": "I",
        },
      },
      {
        id: "stk-9",
        projectId: VILLA_PROJECT_ID,
        name: "Sunita Rao",
        initials: "SR",
        role: "Landscape Architect & Hydraulics Consultant",
        discipline: "Landscape",
        company: "Terra Studio",
        email: "sunita.rao@terrastudio.com",
        phone: "+1 (512) 555-0109",
        whatsapp: "+15125550109",
        status: "in-meeting",
        ownedCount: 2,
        affectedByCount: 3,
        raci: {
          "Subterranean Foundation & Retaining Walls": "C",
          "Cantilevered Superstructure & Slabs": "I",
          "Motorized Slim-Profile Glazing": "I",
          "Geothermal HVAC & Hydronic Systems": "C",
          "Italian Travertine & Architectural Finishes": "C",
          "Smart Home KNX/Lutron Automation": "I",
          "Infinity Edge Pool & Hydraulics": "R",
          "Terraced Landscaping & Courtyards": "R",
        },
      },
    ],
    activities: [
      {
        id: "act-1",
        projectId: VILLA_PROJECT_ID,
        title: "Subterranean Bedrock Excavation & Retaining Walls",
        type: "Civil Works",
        discipline: "Civil",
        owner: "Carlos Gomez",
        ownerInitials: "CG",
        status: "complete",
        dueDate: "2026-08-10",
        location: "Lower Foundation Slope",
        criticalPath: false,
        dependencyCount: 0,
      },
      {
        id: "act-2",
        projectId: VILLA_PROJECT_ID,
        title: "Foundation Seismic Anchor Bolts & Dual Waterproofing",
        type: "Civil Works",
        discipline: "Civil",
        owner: "Carlos Gomez",
        ownerInitials: "CG",
        status: "complete",
        dueDate: "2026-08-22",
        location: "Sub-grade Basement",
        criticalPath: false,
        dependencyCount: 1,
      },
      {
        id: "act-3",
        projectId: VILLA_PROJECT_ID,
        title: "Lower Ground Wine Cellar & Home Theatre Concrete Shell",
        type: "Structural Framing",
        discipline: "Structural",
        owner: "Carlos Gomez",
        ownerInitials: "CG",
        status: "complete",
        dueDate: "2026-09-02",
        location: "Basement Level B1",
        criticalPath: false,
        dependencyCount: 1,
      },
      {
        id: "act-4",
        projectId: VILLA_PROJECT_ID,
        title: "Level 1 Cantilevered Living Room Post-Tensioned Slab",
        type: "Deliverable",
        discipline: "Structural",
        owner: "Rajesh Patel",
        ownerInitials: "RP",
        status: "in-progress",
        dueDate: "2026-09-18",
        location: "Level 1 Great Room",
        criticalPath: true,
        dependencyCount: 2,
      },
      {
        id: "act-5",
        projectId: VILLA_PROJECT_ID,
        title: "Level 2 Master Suite Structural Steel Lintel & Framing",
        type: "Deliverable",
        discipline: "Structural",
        owner: "Rajesh Patel",
        ownerInitials: "RP",
        status: "blocked",
        dueDate: "2026-09-20",
        location: "Level 2 Master Suite",
        criticalPath: true,
        dependencyCount: 2,
        blockedReason:
          "Blocked pending structural engineer sign-off on 12-meter window lintel deflection tolerance under wind load.",
      },
      {
        id: "act-6",
        projectId: VILLA_PROJECT_ID,
        title: "Motorized Floor-to-Ceiling Slim Pocket Glazing Fabrication",
        type: "Milestone",
        discipline: "Facade",
        owner: "Liam Gallagher",
        ownerInitials: "LG",
        status: "at-risk",
        dueDate: "2026-09-25",
        location: "Off-site Factory / Level 2",
        criticalPath: true,
        dependencyCount: 1,
        blockedReason:
          "Awaiting final Level 2 structural deflection confirmation before factory laser extrusion cutting.",
      },
      {
        id: "act-7",
        projectId: VILLA_PROJECT_ID,
        title: "Geothermal Borehole Loop Drilling & Manifold Rough-in",
        type: "Deliverable",
        discipline: "MEP",
        owner: "Tariq Al-Mansoor",
        ownerInitials: "TA",
        status: "in-progress",
        dueDate: "2026-09-22",
        location: "North Courtyard Borefield",
        criticalPath: false,
        dependencyCount: 1,
      },
      {
        id: "act-8",
        projectId: VILLA_PROJECT_ID,
        title: "Level 1 Hydronic Underfloor Heating & Plumbing Sleeves",
        type: "Deliverable",
        discipline: "MEP",
        owner: "Tariq Al-Mansoor",
        ownerInitials: "TA",
        status: "at-risk",
        dueDate: "2026-09-17",
        location: "Level 1 Floor Grid",
        criticalPath: false,
        dependencyCount: 1,
        blockedReason:
          "Core sleeve heights clash with post-tensioned tendon anchor zone TB-01.",
      },
      {
        id: "act-9",
        projectId: VILLA_PROJECT_ID,
        title: "Roman Travertine Pool Deck & Exterior Coping Supply",
        type: "Deliverable",
        discipline: "Interiors",
        owner: "Sophia Lorenzi",
        ownerInitials: "SL",
        status: "pending",
        dueDate: "2026-10-05",
        location: "South Infinity Terrace",
        criticalPath: false,
        dependencyCount: 1,
      },
      {
        id: "act-10",
        projectId: VILLA_PROJECT_ID,
        title: "Infinity Edge Pool Cantilever Drainage & Hydraulics",
        type: "Deliverable",
        discipline: "Landscape",
        owner: "Sunita Rao",
        ownerInitials: "SR",
        status: "in-progress",
        dueDate: "2026-09-28",
        location: "South Pool Basin",
        criticalPath: false,
        dependencyCount: 2,
      },
      {
        id: "act-11",
        projectId: VILLA_PROJECT_ID,
        title: "Smart Home Central KNX/Lutron Automation Rack Conduits",
        type: "Milestone",
        discipline: "MEP",
        owner: "Tariq Al-Mansoor",
        ownerInitials: "TA",
        status: "in-progress",
        dueDate: "2026-09-26",
        location: "Lower Mechanical Hub",
        criticalPath: false,
        dependencyCount: 1,
      },
      {
        id: "act-12",
        projectId: VILLA_PROJECT_ID,
        title: "Teak Architectural Soffits & Master Suite Custom Millwork",
        type: "Deliverable",
        discipline: "Interiors",
        owner: "Sophia Lorenzi",
        ownerInitials: "SL",
        status: "pending",
        dueDate: "2026-10-15",
        location: "Level 2 Cantilever Soffits",
        criticalPath: false,
        dependencyCount: 1,
      },
    ],
    dependencies: [
      {
        id: "dep-1",
        projectId: VILLA_PROJECT_ID,
        fromId: "act-1",
        fromTitle: "Subterranean Bedrock Excavation & Retaining Walls",
        toId: "act-2",
        toTitle: "Foundation Seismic Anchor Bolts & Dual Waterproofing",
        type: "blocks",
        status: "resolved",
      },
      {
        id: "dep-2",
        projectId: VILLA_PROJECT_ID,
        fromId: "act-2",
        fromTitle: "Foundation Seismic Anchor Bolts & Dual Waterproofing",
        toId: "act-3",
        toTitle: "Lower Ground Wine Cellar & Home Theatre Concrete Shell",
        type: "blocks",
        status: "resolved",
      },
      {
        id: "dep-3",
        projectId: VILLA_PROJECT_ID,
        fromId: "act-3",
        fromTitle: "Lower Ground Wine Cellar & Home Theatre Concrete Shell",
        toId: "act-4",
        toTitle: "Level 1 Cantilevered Living Room Post-Tensioned Slab",
        type: "blocks",
        status: "resolved",
      },
      {
        id: "dep-4",
        projectId: VILLA_PROJECT_ID,
        fromId: "act-4",
        fromTitle: "Level 1 Cantilevered Living Room Post-Tensioned Slab",
        toId: "act-5",
        toTitle: "Level 2 Master Suite Structural Steel Lintel & Framing",
        type: "blocks",
        status: "active",
      },
      {
        id: "dep-5",
        projectId: VILLA_PROJECT_ID,
        fromId: "act-5",
        fromTitle: "Level 2 Master Suite Structural Steel Lintel & Framing",
        toId: "act-6",
        toTitle: "Motorized Floor-to-Ceiling Slim Pocket Glazing Fabrication",
        type: "blocks",
        status: "active",
      },
      {
        id: "dep-6",
        projectId: VILLA_PROJECT_ID,
        fromId: "act-4",
        fromTitle: "Level 1 Cantilevered Living Room Post-Tensioned Slab",
        toId: "act-8",
        toTitle: "Level 1 Hydronic Underfloor Heating & Plumbing Sleeves",
        type: "blocks",
        status: "active",
      },
      {
        id: "dep-7",
        projectId: VILLA_PROJECT_ID,
        fromId: "act-4",
        fromTitle: "Level 1 Cantilevered Living Room Post-Tensioned Slab",
        toId: "act-10",
        toTitle: "Infinity Edge Pool Cantilever Drainage & Hydraulics",
        type: "blocks",
        status: "active",
      },
      {
        id: "dep-8",
        projectId: VILLA_PROJECT_ID,
        fromId: "act-7",
        fromTitle: "Geothermal Borehole Loop Drilling & Manifold Rough-in",
        toId: "act-8",
        toTitle: "Level 1 Hydronic Underfloor Heating & Plumbing Sleeves",
        type: "relates-to",
        status: "active",
      },
      {
        id: "dep-9",
        projectId: VILLA_PROJECT_ID,
        fromId: "act-6",
        fromTitle: "Motorized Floor-to-Ceiling Slim Pocket Glazing Fabrication",
        toId: "act-12",
        toTitle: "Teak Architectural Soffits & Master Suite Custom Millwork",
        type: "blocks",
        status: "active",
      },
      {
        id: "dep-10",
        projectId: VILLA_PROJECT_ID,
        fromId: "act-10",
        fromTitle: "Infinity Edge Pool Cantilever Drainage & Hydraulics",
        toId: "act-9",
        toTitle: "Roman Travertine Pool Deck & Exterior Coping Supply",
        type: "blocks",
        status: "active",
      },
    ],
    changes: [
      {
        id: "chg-1",
        projectId: VILLA_PROJECT_ID,
        title: "Master Suite 12-Meter Motorized Panoramic Pocket Glazing Expansion",
        summary:
          "Marcus Vance requested expanding the Master Suite west wall from punch windows to a continuous 12m motorized glass pocket slider. Requires structural steel lintel deflection review (L/600 limit) and floor drainage trench detailing.",
        status: "active",
        severity: "high",
        createdBy: "Marcus Vance",
        discipline: "Architecture",
        affectedCount: 4,
        rawSignal:
          "Marcus standup request: We need the entire 12-meter west wall to slide into hidden pocket walls so the bedroom flows seamlessly onto the upper cantilever terrace. Please coordinate with Liam and Rajesh immediately.",
        createdAt: new Date("2026-09-13T09:00:00Z").toISOString(),
      },
      {
        id: "chg-2",
        projectId: VILLA_PROJECT_ID,
        title: "Underfloor Hydronic Sleeve Clash with Post-Tensioned Tendon Zone TB-01",
        summary:
          "Site inspection revealed that MEP sanitary and hydronic conduit sleeves at Grid D-3 fall within 400mm of the primary post-tensioned tendon anchor plate. Carlos Gomez halted sleeve drilling to prevent tendon strand nicking.",
        status: "active",
        severity: "critical",
        createdBy: "Carlos Gomez",
        discipline: "MEP",
        affectedCount: 3,
        rawSignal:
          "Urgent WhatsApp from Carlos: Rebar team found MEP plastic sleeves directly obstructing tendon anchor duct on TB-01. Tariq needs to offset sleeves 500mm south before tomorrow's inspection.",
        createdAt: new Date("2026-09-13T14:30:00Z").toISOString(),
      },
      {
        id: "chg-3",
        projectId: VILLA_PROJECT_ID,
        title: "Infinity Pool Cantilever Overflow Weep Hole Rerouting",
        summary:
          "Hydraulics review showed pool surge tank drainage path crossed over the lower wine cellar ceiling waterproof envelope. Sunita Rao rerouted discharge piping through the north retaining wall gravity swale.",
        status: "resolved",
        severity: "medium",
        createdBy: "Sunita Rao",
        discipline: "Landscape",
        affectedCount: 2,
        createdAt: new Date("2026-09-11T16:00:00Z").toISOString(),
      },
      {
        id: "chg-4",
        projectId: VILLA_PROJECT_ID,
        title: "Roman Cross-Cut Travertine Finish Substitution for Pool Deck",
        summary:
          "Client and interior architect approved substituting honed cross-cut Roman Travertine for Greek Thassos marble to achieve an R11 non-slip rating and reduce summer surface heat by 14°C.",
        status: "active",
        severity: "medium",
        createdBy: "Sophia Lorenzi",
        discipline: "Interiors",
        affectedCount: 2,
        createdAt: new Date("2026-09-12T11:00:00Z").toISOString(),
      },
      {
        id: "chg-5",
        projectId: VILLA_PROJECT_ID,
        title: "KNX Automation High-Voltage Cable Separation in Cantilever Soffit",
        summary:
          "Low-voltage KNX lighting control cables were routed in shared conduit with 240V heat-pump circuits. Tariq issued change order to install shielded isolated metal raceway to eliminate signal induction flicker.",
        status: "active",
        severity: "low",
        createdBy: "Tariq Al-Mansoor",
        discipline: "MEP",
        affectedCount: 1,
        createdAt: new Date("2026-09-10T10:00:00Z").toISOString(),
      },
    ],
    actions: [
      {
        id: "actn-1",
        projectId: VILLA_PROJECT_ID,
        title: "Issue Structural Calculation Sheet for 12m Steel Lintel Deflection",
        owner: "Rajesh Patel",
        ownerInitials: "RP",
        status: "todo",
        dueDate: "2026-09-16",
        source: "Change: Master Suite Glazing",
        priority: "urgent",
      },
      {
        id: "actn-2",
        projectId: VILLA_PROJECT_ID,
        title: "Offset Level 1 Hydronic Conduits 500mm South of Tendon Anchor TB-01",
        owner: "Tariq Al-Mansoor",
        ownerInitials: "TA",
        status: "in-progress",
        dueDate: "2026-09-17",
        source: "Site Standup: Slab Sleeves",
        priority: "high",
      },
      {
        id: "actn-3",
        projectId: VILLA_PROJECT_ID,
        title: "Confirm Motorized Glass Pocket Cavity Dimensions with Millwork Sub",
        owner: "Liam Gallagher",
        ownerInitials: "LG",
        status: "todo",
        dueDate: "2026-09-18",
        source: "Architecture Coordination",
        priority: "normal",
      },
      {
        id: "actn-4",
        projectId: VILLA_PROJECT_ID,
        title: "Submit Roman Travertine Wet-Slip Pendulum Test Report (R11 Rating)",
        owner: "Sophia Lorenzi",
        ownerInitials: "SL",
        status: "done",
        dueDate: "2026-09-14",
        source: "Client Finishes Selection",
        priority: "normal",
      },
      {
        id: "actn-5",
        projectId: VILLA_PROJECT_ID,
        title: "Pour Concrete Test Cylinders for Level 1 Post-Tensioned Slab 7-Day Break",
        owner: "Carlos Gomez",
        ownerInitials: "CG",
        status: "in-progress",
        dueDate: "2026-09-19",
        source: "Quality Assurance",
        priority: "high",
      },
      {
        id: "actn-6",
        projectId: VILLA_PROJECT_ID,
        title: "Review Geothermal Manifold Flow Sensor Calibration",
        owner: "Tariq Al-Mansoor",
        ownerInitials: "TA",
        status: "todo",
        dueDate: "2026-09-23",
        source: "MEP Commissioning Plan",
        priority: "low",
      },
      {
        id: "actn-7",
        projectId: VILLA_PROJECT_ID,
        title: "Coordinate Pool Coping Waterstop Detail with Landscape Architect",
        owner: "Sunita Rao",
        ownerInitials: "SR",
        status: "in-progress",
        dueDate: "2026-09-20",
        source: "Pool Drainage Review",
        priority: "normal",
      },
      {
        id: "actn-8",
        projectId: VILLA_PROJECT_ID,
        title: "Schedule City Structural Frame Inspection for Level 1 Living Room",
        owner: "David Chen",
        ownerInitials: "DC",
        status: "todo",
        dueDate: "2026-09-21",
        source: "PMC Schedule Control",
        priority: "high",
      },
    ],
    approvals: [
      {
        id: "app-1",
        projectId: VILLA_PROJECT_ID,
        title: "Master Suite 12m Glazing Structural Steel Lintel Sign-Off",
        requester: "Liam Gallagher",
        requesterInitials: "LG",
        approver: "Rajesh Patel",
        status: "pending",
        dueDate: "2026-09-16",
        category: "Structural Engineering Certification",
        impactSummary:
          "Unblocks Level 2 structural steel framing and authorizes factory cutting of $180,000 glass extrusion panels.",
      },
      {
        id: "app-2",
        projectId: VILLA_PROJECT_ID,
        title: "Roman Cross-Cut Travertine Finish Sample Board Sign-Off",
        requester: "Sophia Lorenzi",
        requesterInitials: "SL",
        approver: "Marcus Vance",
        status: "pending",
        dueDate: "2026-09-18",
        category: "Client Aesthetic & Budget Sign-off",
        impactSummary:
          "Authorizes sea-freight release of 4,200 sq ft Italian travertine tiles from Carrara port.",
      },
      {
        id: "app-3",
        projectId: VILLA_PROJECT_ID,
        title: "Level 1 Post-Tensioned Tendon Stressing Protocol Sign-Off",
        requester: "Carlos Gomez",
        requesterInitials: "CG",
        approver: "Rajesh Patel",
        status: "approved",
        dueDate: "2026-09-12",
        category: "Structural Safety Certification",
        impactSummary:
          "Certified tendon elongation parameters; authorized living room cantilever formwork stripping.",
        completedAt: new Date("2026-09-12T14:30:00Z").toISOString(),
      },
      {
        id: "app-4",
        projectId: VILLA_PROJECT_ID,
        title: "Geothermal Loop Vertical Borehole Environmental Permit Sign-Off",
        requester: "Tariq Al-Mansoor",
        requesterInitials: "TA",
        approver: "David Chen",
        status: "approved",
        dueDate: "2026-09-08",
        category: "Environmental & MEP Permit",
        impactSummary:
          "City environmental conservation board granted zero-discharge closed-loop drilling clearance.",
        completedAt: new Date("2026-09-08T11:15:00Z").toISOString(),
      },
      {
        id: "app-5",
        projectId: VILLA_PROJECT_ID,
        title: "Infinity Pool Cantilever Structural Rib Rebar Submittal",
        requester: "Carlos Gomez",
        requesterInitials: "CG",
        approver: "Rajesh Patel",
        status: "pending",
        dueDate: "2026-09-19",
        category: "Structural Submittal",
        impactSummary:
          "Required prior to scheduling concrete pump truck for pool shell on Friday.",
      },
      {
        id: "app-6",
        projectId: VILLA_PROJECT_ID,
        title: "Lutron HomeWorks Central Rack Room Dedicated Cooling Spec",
        requester: "Tariq Al-Mansoor",
        requesterInitials: "TA",
        approver: "David Chen",
        status: "approved",
        dueDate: "2026-09-10",
        category: "Low-Voltage Systems Approval",
        impactSummary:
          "Approved dedicated split fan-coil unit to prevent thermal throttling of central home automation processors.",
        completedAt: new Date("2026-09-10T16:00:00Z").toISOString(),
      },
    ],
    alerts: [
      {
        id: "alt-1",
        projectId: VILLA_PROJECT_ID,
        title: "Critical Blocker: Level 2 Master Suite Structural Lintel Approval Pending",
        description:
          "Liam Gallagher's glazing fabrication is blocked until Rajesh Patel approves the structural deflection calculation.",
        type: "approval",
        severity: "critical",
        acknowledged: false,
      },
      {
        id: "alt-2",
        projectId: VILLA_PROJECT_ID,
        title: "Trade Clash: Level 1 MEP Sleeves Intersecting Post-Tensioned Tendon TB-01",
        description:
          "Carlos Gomez halted slab coring until Tariq Al-Mansoor offsets MEP conduit sleeves by 500mm.",
        type: "impact",
        severity: "high",
        acknowledged: false,
      },
      {
        id: "alt-3",
        projectId: VILLA_PROJECT_ID,
        title: "Lead Time Alert: Travertine Shipping Container Cutoff on Friday",
        description:
          "Italian supplier requires Marcus Vance's sample sign-off by Thursday 5 PM to make the Mediterranean container departure.",
        type: "deadline",
        severity: "high",
        acknowledged: false,
      },
      {
        id: "alt-4",
        projectId: VILLA_PROJECT_ID,
        title: "Permit Milestones: City Frame Inspection Scheduled for Monday",
        description:
          "David Chen has scheduled the municipal building inspector for Level 1 living room framing sign-off.",
        type: "info",
        severity: "medium",
        acknowledged: true,
      },
      {
        id: "alt-5",
        projectId: VILLA_PROJECT_ID,
        title: "Geothermal Boreholes Complete: 8 of 8 Loops Pressure Tested",
        description:
          "Tariq Al-Mansoor reported 100 PSI static pressure hold for 48 hours without leakage.",
        type: "info",
        severity: "low",
        acknowledged: true,
      },
      {
        id: "alt-6",
        projectId: VILLA_PROJECT_ID,
        title: "Pool Shell Concrete Pump Reservation Locked",
        description:
          "Batch plant scheduled for 60 cubic yards 5,000 PSI waterproof mix contingent on rib rebar sign-off.",
        type: "deadline",
        severity: "medium",
        acknowledged: false,
      },
    ],
    memory: [
      {
        id: "mem-4",
        projectId: VILLA_PROJECT_ID,
        title: "Client Master Suite 12-Meter Panoramic Opening Request",
        description:
          "Marcus Vance submitted Change CH-101 requesting expansion of master suite bedroom fenestration to a continuous 12m motorized glass pocket slider. Elena Rostova and Liam Gallagher confirmed feasibility subject to steel lintel deflection check.",
        type: "change",
        actor: "Marcus Vance",
        tags: ["Architecture", "Client Change", "Master Suite", "Glazing", "CH-101"],
        createdAt: new Date("2026-09-13T09:00:00Z").toISOString(),
      },
      {
        id: "mem-3",
        projectId: VILLA_PROJECT_ID,
        title: "Living Room Cantilever Post-Tensioned Tendon Specification Rule",
        description:
          "Rajesh Patel signed off on the parabolic post-tensioning tendon layout with mandatory project rule: No trade or subcontractor may drill core holes within 1.2 meters of transfer beam edge TB-01 without explicit written approval.",
        type: "approval",
        actor: "Rajesh Patel",
        tags: ["Structural", "Cantilever", "Approval", "Critical Rule", "Safety"],
        createdAt: new Date("2026-09-12T14:30:00Z").toISOString(),
      },
      {
        id: "mem-5",
        projectId: VILLA_PROJECT_ID,
        title: "Roman Cross-Cut Honed Travertine Finish Approved for Pool Deck",
        description:
          "Sophia Lorenzi presented sample board #V-104 comparing Greek Thassos marble vs. Roman Cross-Cut Travertine. Marcus Vance selected Travertine for superior wet-slip friction (R11) and thermal comfort under direct afternoon sunlight.",
        type: "decision",
        actor: "Sophia Lorenzi",
        tags: ["Interiors", "Materials", "Pool", "Finishes", "Client Approval"],
        createdAt: new Date("2026-09-12T11:00:00Z").toISOString(),
      },
      {
        id: "mem-7",
        projectId: VILLA_PROJECT_ID,
        title: "Dedicated Cooling Unit Approved for Central Automation Equipment Room",
        description:
          "David Chen and Tariq Al-Mansoor approved adding a dedicated 1.5-ton ductless fan coil for the central KNX/Lutron AV equipment rack room to eliminate equipment thermal throttling risk in summer.",
        type: "approval",
        actor: "David Chen",
        tags: ["MEP", "Automation", "Approval", "Cooling"],
        createdAt: new Date("2026-09-10T16:00:00Z").toISOString(),
      },
      {
        id: "mem-1",
        projectId: VILLA_PROJECT_ID,
        title: "Geothermal HVAC Loop Selection Over Air-Source Split Units",
        description:
          "Marcus Vance and Tariq Al-Mansoor confirmed selection of 8 vertical closed-loop geothermal boreholes drilled 90m deep. Rationale: Eliminates exterior condenser fan noise from the hillside patio and allows pure, uninterrupted architectural soffit lines on the cantilevered terraces.",
        type: "decision",
        actor: "Marcus Vance",
        tags: ["MEP", "HVAC", "Client Decision", "Geothermal", "Architecture"],
        createdAt: new Date("2026-09-08T10:00:00Z").toISOString(),
      },
      {
        id: "mem-8",
        projectId: VILLA_PROJECT_ID,
        title: "Level 1 Living Room Cantilever Concrete Pour Completed",
        description:
          "Carlos Gomez successfully executed 8-hour continuous monolithic pour of 95 cubic yards of high-early 6,000 PSI concrete for the main cantilevered living room terrace under ideal weather conditions.",
        type: "milestone",
        actor: "Carlos Gomez",
        tags: ["Site", "Concrete", "Milestone", "Cantilever"],
        createdAt: new Date("2026-09-06T18:00:00Z").toISOString(),
      },
      {
        id: "mem-6",
        projectId: VILLA_PROJECT_ID,
        title: "Wine Cellar Sump Vent Rerouted Around Primary Grade Beam",
        description:
          "During basement rough-in, plumbing vent clashed with structural grade beam GB-02. Tariq Al-Mansoor rerouted drainage vent through service trench B-3 with 2% slope, preserving grade beam steel reinforcement integrity.",
        type: "issue",
        actor: "Tariq Al-Mansoor",
        tags: ["MEP", "Civil", "Resolution", "Wine Cellar"],
        createdAt: new Date("2026-09-04T15:00:00Z").toISOString(),
      },
      {
        id: "mem-2",
        projectId: VILLA_PROJECT_ID,
        title: "Subterranean Foundation & Bedrock Anchor Inspection Sign-Off",
        description:
          "City building official and Rajesh Patel certified 24 high-tensile rock anchors grouted 6 meters into dense limestone strata. Tensile load tests passed at 220% of design load without displacement, formally closing substructure civil phase.",
        type: "milestone",
        actor: "Rajesh Patel",
        tags: ["Civil", "Foundation", "Inspection", "Milestone", "Structural"],
        createdAt: new Date("2026-08-25T14:00:00Z").toISOString(),
      },
    ],
  };
}

// ─── Persona & Role Configuration ───────────────────────────────────────────
export const ROLE_STAKEHOLDER_MAP: Record<
  string,
  { name: string; email: string; title: string; discipline: string }
> = {
  admin: {
    name: "David Chen",
    email: "david.chen@apex-cm.com",
    title: "Project Delivery Manager",
    discipline: "Project Management",
  },
  owner: {
    name: "Marcus Vance",
    email: "marcus.vance@vanceholdings.com",
    title: "Client / Property Owner",
    discipline: "Client",
  },
  architect: {
    name: "Elena Rostova",
    email: "elena.rostova@studiorostova.com",
    title: "Principal Architect",
    discipline: "Architecture",
  },
  engineer: {
    name: "Rajesh Patel",
    email: "rajesh.patel@patel-eng.com",
    title: "Principal Structural Engineer",
    discipline: "Structural",
  },
  contractor: {
    name: "Carlos Gomez",
    email: "carlos.gomez@apex-cm.com",
    title: "General Contractor / Site Super",
    discipline: "Construction",
  },
  interior: {
    name: "Sophia Laurent",
    email: "sophia.laurent@laurent-design.com",
    title: "Lead Interior Designer",
    discipline: "Interiors",
  },
  mep: {
    name: "Tariq Mansoor",
    email: "tariq.mansoor@mansoor-mep.com",
    title: "MEP & Smart Systems Director",
    discipline: "MEP",
  },
};

export function getRoleTitle(role: string): string {
  return ROLE_STAKEHOLDER_MAP[role?.toLowerCase()]?.title || "Project Delivery Manager";
}

export function getRoleDiscipline(role: string): string {
  return ROLE_STAKEHOLDER_MAP[role?.toLowerCase()]?.discipline || "Project Management";
}

// ─── Multi-Project In-Memory Store & Disk Persistence ───────────────────────
const DATA_DIR = path.join(process.cwd(), "data");
const STORE_FILE = path.join(DATA_DIR, "store.json");

export let projectsStore: Record<string, VillaProjectStore> = {};
export let globalUsers: any[] = [];

export function createNewProjectStore(
  projectId: string,
  projectName: string,
  ownerId: string,
  ownerName: string,
  ownerRole: string
): VillaProjectStore {
  const initials = ownerName
    .trim()
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const title = getRoleTitle(ownerRole);
  const discipline = getRoleDiscipline(ownerRole);

  const initialStakeholder = {
    id: "stk-" + Date.now(),
    projectId,
    name: ownerName,
    initials,
    role: title,
    discipline,
    company: projectName,
    email: "",
    phone: "",
    whatsapp: "",
    status: "online",
    ownedCount: 0,
    affectedByCount: 0,
    raci: {},
  };

  return {
    project: {
      id: projectId,
      name: projectName,
      description: `Active coordination workspace for ${projectName}. Track live handoffs, cross-discipline blast radius changes, and role sign-offs.`,
      location: "Project Site Location",
      phase: "Planning & Mobilization",
      status: "On Track",
      progress: 0,
      ownerId,
      isDemo: false,
      updatedAt: new Date().toISOString(),
    },
    users: [],
    stakeholders: [initialStakeholder],
    activities: [], // Clean: No static fake activities for real users!
    dependencies: [],
    changes: [],
    actions: [],
    approvals: [],
    alerts: [],
    memory: [
      {
        id: "mem-" + Date.now(),
        projectId,
        title: `Project workspace initialized: ${projectName}`,
        description: `Workspace created by ${ownerName} (${title}). Live coordination layer active.`,
        type: "milestone",
        actor: ownerName,
        tags: ["Project Setup", discipline],
        createdAt: new Date().toISOString(),
      },
    ],
  };
}

export function getProjectStore(projectId?: string): VillaProjectStore {
  const id = projectId || VILLA_PROJECT_ID;
  if (!projectsStore[id]) {
    if (id === VILLA_PROJECT_ID) {
      projectsStore[VILLA_PROJECT_ID] = createInitialVillaStore();
    } else {
      projectsStore[id] = createNewProjectStore(id, "My Project", "usr-auto", "Project Lead", "admin");
    }
  }
  return projectsStore[id];
}

export function saveStoreToDisk(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    // 1. Transactionally sync every project and all nested rows into Neon PostgreSQL Database
    for (const [pId, pStore] of Object.entries(projectsStore)) {
      if (pStore && pStore.project) {
        neonSaveFullProjectStore(pStore).catch((e) =>
          console.error(`[Neon DB] Project sync failed for ${pId}:`, e.message)
        );
      }
    }
    for (const u of globalUsers) {
      neonUpsertUser(u).catch((e) =>
        console.error(`[Neon DB] User upsert failed for ${u.email}:`, e.message)
      );
    }
    // 2. Backup to JSON
    const payload = {
      projects: projectsStore,
      users: globalUsers,
    };
    fs.writeFileSync(STORE_FILE, JSON.stringify(payload, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to persist store to Neon/disk:", err);
  }
}

export async function loadStoreFromDisk(): Promise<void> {
  try {
    // 1. First attempt to load structured data from Neon PostgreSQL database
    const neonUsers = await neonGetAllUsers();
    if (neonUsers && neonUsers.length > 0) {
      globalUsers = neonUsers;
      for (const u of neonUsers) {
        if (u.projectId && u.projectId !== VILLA_PROJECT_ID) {
          const uStore = await neonGetProjectStore(u.projectId);
          if (uStore && uStore.project) {
            projectsStore[u.projectId] = uStore;
          }
        }
      }
    }
  } catch (err: any) {
    console.warn("Failed to load initial state from Neon PostgreSQL:", err.message);
  }

  if (globalUsers.length === 0 && fs.existsSync(STORE_FILE)) {
    try {
      const raw = fs.readFileSync(STORE_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed) {
        if (parsed.projects && typeof parsed.projects === "object") {
          projectsStore = parsed.projects;
          globalUsers = parsed.users || [];
        } else if (parsed.project && Array.isArray(parsed.users)) {
          projectsStore = { [VILLA_PROJECT_ID]: parsed };
          globalUsers = parsed.users || [];
        }
      }
    } catch {}
  }

  // Ensure VILLA_PROJECT_ID is always present and seeded for Demo Mode
  if (!projectsStore[VILLA_PROJECT_ID] || !projectsStore[VILLA_PROJECT_ID].project) {
    projectsStore[VILLA_PROJECT_ID] = createInitialVillaStore();
  }

  // Ensure demo user David Chen is in globalUsers
  if (!globalUsers.some((u) => u.email === "david.chen@apex-cm.com")) {
    globalUsers.unshift({
      id: DEMO_USER_ID,
      name: "David Chen",
      email: "david.chen@apex-cm.com",
      role: "admin",
      projectId: VILLA_PROJECT_ID,
    });
  }

  // Ensure all non-demo users have their own dedicated project workspace
  globalUsers.forEach((u) => {
    if (u.email !== "david.chen@apex-cm.com") {
      if (
        !u.projectId ||
        u.projectId === VILLA_PROJECT_ID ||
        !projectsStore[u.projectId] ||
        projectsStore[u.projectId]?.project?.isDemo
      ) {
        const pId = "proj-" + u.id;
        u.projectId = pId;
        if (!projectsStore[pId]) {
          const pName = u.name ? `${u.name}'s Project` : "My Construction Project";
          projectsStore[pId] = createNewProjectStore(pId, pName, u.id, u.name, u.role || "admin");
          if (projectsStore[pId].stakeholders[0]) {
            projectsStore[pId].stakeholders[0].email = u.email;
          }
        }
      }
    }
  });

  // Clean any old static tasks from real user non-demo projects and ensure chronological memory order across all projects
  Object.values(projectsStore).forEach((pStore) => {
    if (pStore && pStore.project && !pStore.project.isDemo) {
      if (pStore.activities?.some((a: any) => a.title === "Geotechnical Site Survey & Datum Verification")) {
        pStore.activities = [];
        pStore.dependencies = [];
        pStore.changes = [];
        pStore.actions = [];
        pStore.approvals = [];
        pStore.alerts = [];
        pStore.project.progress = 0;
      }
    }
    if (pStore && Array.isArray(pStore.memory)) {
      pStore.memory.sort((a: any, b: any) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });
    }
  });

  saveStoreToDisk();
}

// Initialize on startup
loadStoreFromDisk();

// Backwards compatibility proxy for any code referencing villaStore
export const villaStore: VillaProjectStore = new Proxy({} as VillaProjectStore, {
  get(_target, prop) {
    const store = getProjectStore(VILLA_PROJECT_ID);
    return (store as any)[prop];
  },
  set(_target, prop, value) {
    const store = getProjectStore(VILLA_PROJECT_ID);
    (store as any)[prop] = value;
    return true;
  },
});

// ─── POST /api/auth/demo-login ─────────────────────────────────────────────────
// Exactly ONE Demo Login button endpoint for The Grand Vista Luxury Villa project
router.post("/auth/demo-login", async (_req, res) => {
  try {
    const user = {
      id: DEMO_USER_ID,
      name: "David Chen",
      email: "david.chen@apex-cm.com",
      role: "admin",
      projectId: VILLA_PROJECT_ID,
    };

    const token = signToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      projectId: user.projectId,
      role: user.role as any,
    });

    return res.json({
      token,
      user,
    });
  } catch (err: any) {
    console.error("Demo login error:", err);
    return res.status(500).json({ error: "Failed to initialize demo: " + err.message });
  }
});

// ─── POST /api/auth/register ─────────────────────────────────────────────────
// New user registration creates a dedicated, separate project workspace
router.post("/auth/register", async (req, res) => {
  try {
    const { name, email, password, role = "admin", projectName } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Full name, email address, and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long" });
    }

    const cleanEmail = email.toLowerCase().trim();
    if (globalUsers.some((u) => u.email === cleanEmail)) {
      return res.status(400).json({ error: "An account with this email already exists. Please sign in instead." });
    }

    const passwordHash = await hashPassword(password);
    const userId = "usr-" + Date.now();
    const newProjectId = "proj-" + Date.now();
    const cleanRole = (role || "admin").toLowerCase().trim();
    const resolvedProjectName = (projectName?.trim() || `${name.trim()}'s Project`);

    // Create fresh isolated project workspace for this new user
    const newProjectStore = createNewProjectStore(
      newProjectId,
      resolvedProjectName,
      userId,
      name.trim(),
      cleanRole
    );
    if (newProjectStore.stakeholders[0]) {
      newProjectStore.stakeholders[0].email = cleanEmail;
    }
    projectsStore[newProjectId] = newProjectStore;

    const newUser = {
      id: userId,
      name: name.trim(),
      email: cleanEmail,
      passwordHash,
      role: cleanRole,
      projectId: newProjectId,
      createdAt: new Date().toISOString(),
    };

    globalUsers.push(newUser);

    // Persist directly to Neon PostgreSQL database and backup
    try {
      await neonUpsertUser(newUser);
      await neonSaveFullProjectStore(newProjectStore);
    } catch (e: any) {
      console.warn("[Neon DB] Direct register persist error:", e.message);
    }
    saveStoreToDisk();

    const token = signToken({
      userId: newUser.id,
      email: newUser.email,
      name: newUser.name,
      projectId: newUser.projectId,
      role: newUser.role,
    });

    return res.status(201).json({
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        projectId: newUser.projectId,
        projectName: resolvedProjectName,
      },
    });
  } catch (err: any) {
    console.error("Register error:", err);
    return res.status(500).json({ error: "Registration failed: " + err.message });
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const cleanEmail = email.toLowerCase().trim();

    // If demo account email
    if (cleanEmail === "david.chen@apex-cm.com") {
      const demoUser = {
        id: DEMO_USER_ID,
        name: "David Chen",
        email: cleanEmail,
        role: "admin",
        projectId: VILLA_PROJECT_ID,
      };
      const token = signToken({
        userId: demoUser.id,
        email: demoUser.email,
        name: demoUser.name,
        projectId: demoUser.projectId,
        role: demoUser.role as any,
      });
      return res.json({ token, user: demoUser });
    }

    // Look up registered user in globalUsers or query Neon DB directly
    let user = globalUsers.find((u) => u.email === cleanEmail);
    if (!user) {
      const neonUser = await neonGetUserByEmail(cleanEmail);
      if (neonUser) {
        user = neonUser;
        globalUsers.push(user);
        if (user.projectId && !projectsStore[user.projectId]) {
          const uStore = await neonGetProjectStore(user.projectId);
          if (uStore) {
            projectsStore[user.projectId] = uStore;
          }
        }
      }
    }
    if (!user) {
      return res.status(401).json({
        error: "Account not found with this email. Please check your credentials or create a new account.",
      });
    }

    // Verify password if hash exists
    if (user.passwordHash) {
      const match = await comparePassword(password, user.passwordHash);
      if (!match) {
        return res.status(401).json({ error: "Invalid password. Please check your credentials." });
      }
    }

    // Non-demo users must NEVER be on VILLA_PROJECT_ID
    if (
      !user.projectId ||
      user.projectId === VILLA_PROJECT_ID ||
      !projectsStore[user.projectId] ||
      projectsStore[user.projectId]?.project?.isDemo
    ) {
      const userProjectId = "proj-" + user.id;
      user.projectId = userProjectId;
      if (!projectsStore[userProjectId]) {
        const projectName = user.name ? `${user.name}'s Project` : "My Construction Project";
        projectsStore[userProjectId] = createNewProjectStore(
          userProjectId,
          projectName,
          user.id,
          user.name,
          user.role || "admin"
        );
        if (projectsStore[userProjectId].stakeholders[0]) {
          projectsStore[userProjectId].stakeholders[0].email = cleanEmail;
        }
      }
      saveStoreToDisk();
    }

    const projectId = user.projectId;
    const projectStore = getProjectStore(projectId);

    const token = signToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      projectId,
      role: user.role,
    });

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        projectId,
        projectName: projectStore.project?.name,
      },
    });
  } catch (err: any) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Login failed: " + err.message });
  }
});

// ─── GET /api/auth/me ────────────────────────────────────────────────────────
router.get("/auth/me", authMiddleware, async (req, res) => {
  let projectId = req.user!.projectId;
  const userEmail = req.user!.email.toLowerCase().trim();

  // If non-demo user somehow has VILLA_PROJECT_ID, fix it immediately
  if (userEmail !== "david.chen@apex-cm.com") {
    if (
      !projectId ||
      projectId === VILLA_PROJECT_ID ||
      !projectsStore[projectId] ||
      projectsStore[projectId]?.project?.isDemo
    ) {
      projectId = "proj-" + req.user!.userId;
      if (!projectsStore[projectId]) {
        const projectName = req.user!.name ? `${req.user!.name}'s Project` : "My Construction Project";
        projectsStore[projectId] = createNewProjectStore(
          projectId,
          projectName,
          req.user!.userId,
          req.user!.name,
          req.user!.role || "admin"
        );
        if (projectsStore[projectId].stakeholders[0]) {
          projectsStore[projectId].stakeholders[0].email = userEmail;
        }
        saveStoreToDisk();
      }
    }
  }

  const projectStore = getProjectStore(projectId || undefined);
  return res.json({
    id: req.user!.userId,
    name: req.user!.name,
    email: req.user!.email,
    role: req.user!.role,
    projectId,
    projectName: projectStore.project?.name || "My Project",
    isDemo: projectId === VILLA_PROJECT_ID,
  });
});

// ─── POST /api/auth/seed-demo ─────────────────────────────────────────────────
router.post("/auth/seed-demo", authMiddleware, async (_req, res) => {
  try {
    projectsStore[VILLA_PROJECT_ID] = createInitialVillaStore();
    saveStoreToDisk();
    return res.json({
      success: true,
      message: "The Grand Vista Luxury Villa project re-seeded successfully!",
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Seed failed: " + err.message });
  }
});

// ─── POST /api/auth/switch-role ───────────────────────────────────────────────
// Demo role switcher: seamlessly switch between stakeholders for permission testing
router.post("/auth/switch-role", authMiddleware, async (req, res) => {
  try {
    const { role } = req.body;
    if (!role) {
      return res.status(400).json({ error: "Role is required" });
    }

    const cleanRole = role.toLowerCase().trim();
    const persona = ROLE_STAKEHOLDER_MAP[cleanRole] || {
      name: req.body.name || req.user!.name,
      email: req.body.email || req.user!.email,
      title: getRoleTitle(cleanRole),
      discipline: getRoleDiscipline(cleanRole),
    };

    const userPayload = {
      userId: req.user!.userId,
      email: persona.email,
      name: persona.name,
      role: cleanRole,
      projectId: req.user!.projectId || VILLA_PROJECT_ID,
    };

    invalidateUserSession(req.user!.userId);
    const token = signToken(userPayload);

    return res.json({
      token,
      user: {
        id: req.user!.userId,
        name: persona.name,
        email: persona.email,
        role: cleanRole,
        projectId: userPayload.projectId,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to switch role: " + err.message });
  }
});

export default router;
