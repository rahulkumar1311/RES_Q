// Disaster Intelligence & System Architecture About View
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Shield,
  AlertTriangle,
  Radio,
  Navigation,
  Brain,
  Layers,
  Activity,
  Droplets,
  Mountain,
  Target,
  CheckCircle2,
  Cpu,
  Globe,
  Compass,
  Zap,
  Satellite,
  Car,
  PhoneCall,
  ChevronRight,
  Workflow,
} from 'lucide-react'
import styles from './AboutView.module.css'

// Architecture Pipeline Stages for Interactive Diagram
const PIPELINE_STAGES = [
  {
    id: 'ingestion',
    step: '01',
    name: 'Multi-Source Ingestion',
    shortName: 'Ingestion Mesh',
    badge: 'RAW TELEMETRY',
    badgeColor: '#2563eb',
    icon: Satellite,
    tagline: 'Continuous spatial, meteorological, and citizen data ingestion',
    description:
      'Aggregates multi-spectral satellite Digital Elevation Models (DEM), IMD meteorological precipitation feeds, real-time RSS disaster news bulletins, and citizen crowd-sourced damage reports.',
    specs: [
      { label: 'Ingestion Frequency', value: 'Real-Time / 15-min RSS Cron' },
      { label: 'Spatial Coverage', value: 'Global & 500m Micro-Grids' },
      { label: 'Primary Inputs', value: 'Satellite DEM, RSS, IMD, Citizen Geo-Pins' },
      { label: 'Redundancy', value: 'In-Memory Cache & Offline Sync' },
    ],
  },
  {
    id: 'ai_nlp',
    step: '02',
    name: 'AI & Edge Inference Engine',
    shortName: 'Edge AI & NLP',
    badge: 'QUALCOMM SNAPDRAGON',
    badgeColor: '#7c3aed',
    icon: Brain,
    tagline: 'On-device vision classifier & natural language disaster parser',
    description:
      'Extracts structured hazard classifications using on-device quantized MobileNetV3 models (<45ms inference) alongside regional NLP entity extractors that map unstructured news to exact coordinates and severity ratings.',
    specs: [
      { label: 'Vision Model', value: 'MobileNetV3-Large-Hazard (v1.0)' },
      { label: 'Inference Latency', value: '< 45ms on Snapdragon NPU / CPU' },
      { label: 'NLP Classifier', value: 'Rule-Engine + ML Hazard Categorizer' },
      { label: 'Blackout Mode', value: '100% Local Inference without Cloud' },
    ],
  },
  {
    id: 'risk_grid',
    step: '03',
    name: '500m Spatio-Temporal Risk Grid',
    shortName: '500m Risk Grid',
    badge: 'POSTGIS & SPATIAL ENGINE',
    badgeColor: '#059669',
    icon: Layers,
    tagline: 'Dynamic multi-factor synthesis across hexagonal and square 500m cells',
    description:
      'Every geographic cell synthesizes static terrain topography (elevation, slope, river proximity) and dynamic disaster telemetry (rainfall, verified road blockages, active floods) into an explainable 0–100 Risk Score.',
    specs: [
      { label: 'Grid Resolution', value: '500m × 500m Micro-Cells' },
      { label: 'Risk Factors', value: '6 Independent Dynamic & Static Channels' },
      { label: 'Temporal Decay', value: 'Automated 12-Hour Stale Event Decay' },
      { label: 'Database', value: 'PostGIS ST_Contains & Spatial Indexing' },
    ],
  },
  {
    id: 'routing',
    step: '04',
    name: 'Life-Critical Risk Routing',
    shortName: 'Safe Rerouting',
    badge: 'VALHALLA & DIJKSTRA',
    badgeColor: '#ea580c',
    icon: Navigation,
    tagline: 'Penalty-weighted navigation algorithms that strictly avoid disaster corridors',
    description:
      'Unlike conventional GPS engines that blindly prioritize transit speed, RESQ penalizes road segments traversing high-risk, flooded, or bridge-compromised cells to calculate provably safe evacuation routes.',
    specs: [
      { label: 'Routing Engine', value: 'Valhalla API + Graph Reroute Engine' },
      { label: 'Cost Function', value: 'Distance + Risk Penalty Matrix' },
      { label: 'Turn-by-Turn', value: 'Live RESQ Driving Navigation Mode' },
      { label: 'Dynamic Reroute', value: 'Real-Time WebSocket Inundation Triggers' },
    ],
  },
  {
    id: 'dispatch',
    step: '05',
    name: 'Emergency Command & SOS Mesh',
    shortName: 'Command & SOS',
    badge: 'FIRST RESPONDER MESH',
    badgeColor: '#dc2626',
    icon: PhoneCall,
    tagline: 'Automated civilian SOS broadcasting and emergency hospital routing',
    description:
      'In critical emergencies, citizens trigger a one-tap SOS transmitting live coordinates and safety status to nearest Police Command, SDRF rescue outposts, and trauma centers with offline mesh fallback.',
    specs: [
      { label: 'SOS Transmission', value: 'WebSockets + Geo-Tagged Dispatch' },
      { label: 'Resource Routing', value: 'Nearest 4 Verified Facilities' },
      { label: 'Offline Fallback', value: 'SMS Protocol & Local Incident Cache' },
      { label: 'Broadcast Feeds', value: 'CAP (Common Alerting Protocol) Ready' },
    ],
  },
]

// The 6 Multi-Factor Hazard Channels
const HAZARD_CHANNELS = [
  {
    icon: Droplets,
    color: '#0284c7',
    bg: '#f0f9ff',
    title: 'Hydrology & River Basin Buffer',
    category: 'STATIC + DYNAMIC',
    weight: '30% Weight',
    description:
      'Computes distance to regional drainage channels (e.g. Brahmaputra basin), floodplain susceptibility curves, and seasonal waterbody saturation.',
  },
  {
    icon: Mountain,
    color: '#d97706',
    bg: '#fffbeb',
    title: 'Digital Elevation & Slope Stability',
    category: 'TOPOGRAPHIC DEM',
    weight: '25% Weight',
    description:
      'Analyzes mean elevation, slope inclination angles, and landslide slip planes to identify transit chokepoints susceptible to debris runoff.',
  },
  {
    icon: Activity,
    color: '#ef4444',
    bg: '#fef2f2',
    title: 'Active Flood & Waterlogging Inundation',
    category: 'REAL-TIME SENSORS',
    weight: '20% Weight',
    description:
      'Tracks direct cell flooding, waterlogging on highway underpasses, and breached riverbanks verified by emergency authorities and NLP bulletins.',
  },
  {
    icon: AlertTriangle,
    color: '#dc2626',
    bg: '#fef2f2',
    title: 'Structural Road & Bridge Blockage',
    category: 'TRANSIT CORRIDOR',
    weight: '15% Weight',
    description:
      'Flags physical transit corridor closures, compromised bridges, mudflow bottlenecks, and mandatory physical bypass zones.',
  },
  {
    icon: Radio,
    color: '#7c3aed',
    bg: '#f5f3ff',
    title: 'NLP Disaster News Bulletins',
    category: 'MACHINE LEARNING',
    weight: '10% Weight',
    description:
      'Extracts spatial disaster incidents from government press releases, meteorological alerts, and regional news desks using automated NLP.',
  },
  {
    icon: Cpu,
    color: '#2563eb',
    bg: '#eff6ff',
    title: 'Snapdragon On-Device AI Vision',
    category: 'EDGE INTELLIGENCE',
    weight: 'VERIFIED EVIDENCE',
    description:
      'Runs quantized deep neural vision models directly on user mobile hardware to classify flood severity, debris, and infrastructure hazards.',
  },
]

// Interactive Risk Band Thresholds
const INTERACTIVE_BANDS = [
  {
    band: 'LOW',
    range: '0 – 24.9',
    color: '#10b981',
    bg: '#ecfdf5',
    border: '#a7f3d0',
    title: 'Safe Baseline Transit',
    summary: 'Corridors fully operational. No active inundation or structural hazards reported.',
    routingEffect: 'Fastest standard routing permitted across all highways and city arterials.',
    recommendation: 'Normal driving conditions. Routine seasonal awareness advised.',
  },
  {
    band: 'MODERATE',
    range: '25 – 44.9',
    color: '#d97706',
    bg: '#fffbeb',
    border: '#fde68a',
    title: 'Cautionary Advisory',
    summary: 'Localized precipitation or cautionary slope conditions noted in the regional grid.',
    routingEffect: 'Corridors remain open with slight travel time padding and cautionary alerts.',
    recommendation: 'Reduce speed on bridges and low-lying transit corridors. Monitor live weather.',
  },
  {
    band: 'HIGH',
    range: '45 – 69.9',
    color: '#ea580c',
    bg: '#fff7ed',
    border: '#fed7aa',
    title: 'Elevated Disaster Threat',
    summary: 'Waterlogging, heavy runoff, or partial lane blockages active along transit corridor.',
    routingEffect: 'Routing engine actively applies risk penalties to divert traffic to elevated roads.',
    recommendation: 'Avoid non-essential transit through this cell. Use RESQ alternate routes.',
  },
  {
    band: 'CRITICAL',
    range: '70 – 100',
    color: '#dc2626',
    bg: '#fef2f2',
    border: '#fecaca',
    title: 'Severe Emergency Blockage',
    summary: 'Flash flood breaches, submerged bridges, or landslide mudflow active. Corridor impassable.',
    routingEffect: 'Roads strictly blocked in routing graph; physical bypass path mathematically enforced.',
    recommendation: 'Immediate evacuation or shelter required. First responders dispatched.',
  },
]

export default function AboutView() {
  const [activeStageId, setActiveStageId] = useState('ingestion')
  const [activeBandKey, setActiveBandKey] = useState('CRITICAL')

  const activeStage = PIPELINE_STAGES.find((s) => s.id === activeStageId) || PIPELINE_STAGES[0]
  const activeBand = INTERACTIVE_BANDS.find((b) => b.band === activeBandKey) || INTERACTIVE_BANDS[3]

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        {/* HERO SECTION */}
        <header className={styles.heroSection}>
          <div className={styles.heroBadgeRow}>
            <div className={styles.chipPulse}>
              <span className={styles.pulseDot} />
              <span>GLOBAL DISASTER INTELLIGENCE PLATFORM</span>
            </div>
            <div className={styles.hardwareBadge}>
              <Cpu size={12} />
              <span>QUALCOMM SNAPDRAGON EDGE AI POWERED</span>
            </div>
          </div>

          <h1 className={styles.heroTitle}>
            Disaster risk, made visible <span className={styles.gradientText}>before it is urgent.</span>
          </h1>

          <p className={styles.heroSubtitle}>
            Conventional GPS tools optimize strictly for transit speed and distance. During a flash flood,
            landslide, or structural bridge collapse, the shortest path can be fatal. RESQ continuously computes
            multi-factor risk across <strong>500m geographic cells</strong>, empowering citizens and first
            responders with life-saving route foresight.
          </p>

          {/* Key Architectural Stats Bar */}
          <div className={styles.metricsRow}>
            <div className={styles.metricCard}>
              <div className={styles.metricVal}>500m</div>
              <div className={styles.metricLabel}>Spatial Resolution</div>
              <div className={styles.metricSub}>Granular PostGIS Micro-Cells</div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricVal}>&lt; 45ms</div>
              <div className={styles.metricLabel}>On-Device Inference</div>
              <div className={styles.metricSub}>Snapdragon NPU / CPU Engine</div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricVal}>6 Channels</div>
              <div className={styles.metricLabel}>Multi-Factor Fusion</div>
              <div className={styles.metricSub}>Hydrology, Slope, NLP & Vision</div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricVal}>100%</div>
              <div className={styles.metricLabel}>Offline Resilience</div>
              <div className={styles.metricSub}>Autonomous Emergency Mode</div>
            </div>
          </div>
        </header>

        {/* SECTION 1: INTERACTIVE ARCHITECTURE PIPELINE DIAGRAM */}
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitleRow}>
              <Workflow size={20} className={styles.sectionIcon} style={{ color: '#2563eb' }} />
              <div>
                <h2 className={styles.sectionTitle}>The RESQ Intelligence Pipeline</h2>
                <p className={styles.sectionDesc}>
                  Interactive end-to-end telemetry architecture: from multi-source data ingestion to on-device AI
                  and emergency route dispatch.
                </p>
              </div>
            </div>
          </div>

          {/* Interactive Flowchart Nodes */}
          <div className={styles.pipelineFlow}>
            {PIPELINE_STAGES.map((stg, index) => {
              const Icon = stg.icon
              const isActive = stg.id === activeStageId
              return (
                <div key={stg.id} className={styles.pipelineStepWrapper}>
                  <button
                    type="button"
                    className={`${styles.pipelineNode} ${isActive ? styles.pipelineNodeActive : ''}`}
                    onClick={() => setActiveStageId(stg.id)}
                    aria-label={`Select stage ${stg.name}`}
                  >
                    <div className={styles.nodeTopRow}>
                      <span className={styles.nodeStepNum}>{stg.step}</span>
                      <span
                        className={styles.nodeStatusDot}
                        style={{ background: isActive ? stg.badgeColor : '#94a3b8' }}
                      />
                    </div>
                    <div
                      className={styles.nodeIconBox}
                      style={{
                        background: isActive ? stg.badgeColor + '18' : '#f1f5f9',
                        color: isActive ? stg.badgeColor : '#64748b',
                      }}
                    >
                      <Icon size={20} />
                    </div>
                    <span className={styles.nodeTitle}>{stg.shortName}</span>
                    <span className={styles.nodeSub}>{stg.badge}</span>
                  </button>
                  {index < PIPELINE_STAGES.length - 1 && (
                    <div className={styles.pipelineConnector}>
                      <div className={styles.connectorLine} />
                      <ChevronRight size={14} className={styles.connectorArrow} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Active Stage Detailed Breakdown Panel */}
          <div className={styles.stageDetailCard}>
            <div className={styles.stageDetailHeader}>
              <div className={styles.stageDetailLeft}>
                <span className={styles.stageBadge} style={{ background: activeStage.badgeColor + '20', color: activeStage.badgeColor }}>
                  STAGE {activeStage.step}: {activeStage.badge}
                </span>
                <h3 className={styles.stageName}>{activeStage.name}</h3>
                <p className={styles.stageTagline}>{activeStage.tagline}</p>
              </div>
            </div>

            <p className={styles.stageDescription}>{activeStage.description}</p>

            <div className={styles.stageSpecsGrid}>
              {activeStage.specs.map((spc, i) => (
                <div key={i} className={styles.specBox}>
                  <span className={styles.specLabel}>{spc.label}</span>
                  <span className={styles.specValue}>{spc.value}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 2: 6 CORE MULTI-FACTOR HAZARD CHANNELS */}
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitleRow}>
              <Layers size={20} className={styles.sectionIcon} style={{ color: '#059669' }} />
              <div>
                <h2 className={styles.sectionTitle}>Multi-Factor Spatial Risk Decomposition</h2>
                <p className={styles.sectionDesc}>
                  RESQ avoids simplistic single-point assumptions by fusing six scientific hazard channels into
                  every 500m cell.
                </p>
              </div>
            </div>
          </div>

          <div className={styles.channelsGrid}>
            {HAZARD_CHANNELS.map((ch, idx) => {
              const Icon = ch.icon
              return (
                <div key={idx} className={styles.channelCard}>
                  <div className={styles.channelHeader}>
                    <div className={styles.channelIconBox} style={{ background: ch.bg, color: ch.color }}>
                      <Icon size={18} />
                    </div>
                    <div>
                      <span className={styles.channelCategory}>{ch.category}</span>
                      <span className={styles.channelWeight}>{ch.weight}</span>
                    </div>
                  </div>
                  <h3 className={styles.channelTitle}>{ch.title}</h3>
                  <p className={styles.channelDesc}>{ch.description}</p>
                </div>
              )
            })}
          </div>
        </section>

        {/* SECTION 3: INTERACTIVE RISK BANDS & NAVIGATION PROTOCOLS */}
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitleRow}>
              <Target size={20} className={styles.sectionIcon} style={{ color: '#ea580c' }} />
              <div>
                <h2 className={styles.sectionTitle}>Interactive Risk Bands & Routing Protocols</h2>
                <p className={styles.sectionDesc}>
                  Select a risk band to see how RESQ adapts its turn-by-turn navigation engine and responder dispatch.
                </p>
              </div>
            </div>
          </div>

          {/* Risk Band Selector Bar */}
          <div className={styles.bandSelectorGrid}>
            {INTERACTIVE_BANDS.map((b) => {
              const isSelected = b.band === activeBandKey
              return (
                <button
                  key={b.band}
                  type="button"
                  className={`${styles.bandSelectorCard} ${isSelected ? styles.bandSelectorCardActive : ''}`}
                  onClick={() => setActiveBandKey(b.band)}
                  style={{
                    borderColor: isSelected ? b.color : 'rgba(226, 232, 240, 0.9)',
                    background: isSelected ? b.bg : '#ffffff',
                  }}
                >
                  <div className={styles.bandPill} style={{ background: b.color + '22', color: b.color, borderColor: b.color + '44' }}>
                    {b.band}
                  </div>
                  <div className={styles.bandScoreRange}>{b.range} / 100</div>
                  <div className={styles.bandShortTitle}>{b.title}</div>
                </button>
              )
            })}
          </div>

          {/* Active Band Protocol Preview */}
          <div
            className={styles.bandProtocolCard}
            style={{ borderColor: activeBand.border, background: activeBand.bg }}
          >
            <div className={styles.protocolHeader}>
              <div className={styles.protocolTitleGroup}>
                <span className={styles.protocolStatusDot} style={{ background: activeBand.color }} />
                <h3 className={styles.protocolHeading} style={{ color: activeBand.color }}>
                  {activeBand.band} INDEX PROTOCOL ({activeBand.range})
                </h3>
              </div>
              <span className={styles.protocolBadge} style={{ background: activeBand.color, color: '#ffffff' }}>
                {activeBand.title}
              </span>
            </div>

            <div className={styles.protocolGrid}>
              <div className={styles.protocolItem}>
                <div className={styles.protocolItemTitle}>
                  <Shield size={14} style={{ color: activeBand.color }} />
                  <span>Ground Conditions</span>
                </div>
                <p className={styles.protocolItemText}>{activeBand.summary}</p>
              </div>

              <div className={styles.protocolItem}>
                <div className={styles.protocolItemTitle}>
                  <Navigation size={14} style={{ color: activeBand.color }} />
                  <span>Routing Engine Impact</span>
                </div>
                <p className={styles.protocolItemText}>{activeBand.routingEffect}</p>
              </div>

              <div className={styles.protocolItem}>
                <div className={styles.protocolItemTitle}>
                  <AlertTriangle size={14} style={{ color: activeBand.color }} />
                  <span>Civilian & Responder Action</span>
                </div>
                <p className={styles.protocolItemText}>{activeBand.recommendation}</p>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 4: GLOBAL SCALE & OFFLINE FIRST PHILOSOPHY */}
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitleRow}>
              <Globe size={20} className={styles.sectionIcon} style={{ color: '#2563eb' }} />
              <div>
                <h2 className={styles.sectionTitle}>Built for the Real, Global World</h2>
                <p className={styles.sectionDesc}>
                  Disasters do not respect cell tower boundaries. RESQ is built from the ground up to operate
                  during complete telecommunications blackout.
                </p>
              </div>
            </div>
          </div>

          <div className={styles.philosophyGrid}>
            <div className={styles.philosophyCard}>
              <div className={styles.philosophyIcon}>
                <Compass size={22} style={{ color: '#0284c7' }} />
              </div>
              <h3 className={styles.philosophyTitle}>Universal Geographic Scope</h3>
              <p className={styles.philosophyText}>
                Engineered with dynamic spatial proximity discovery. Seamlessly models local river valleys,
                national transport corridors, and international urban centers from Guwahati to Tokyo, New York,
                and London.
              </p>
            </div>

            <div className={styles.philosophyCard}>
              <div className={styles.philosophyIcon}>
                <Zap size={22} style={{ color: '#7c3aed' }} />
              </div>
              <h3 className={styles.philosophyTitle}>Edge-First Autonomous Computing</h3>
              <p className={styles.philosophyText}>
                When power grids fail and cellular backhauls collapse, RESQ’s on-device Snapdragon MobileNetV3
                AI and cached spatial grid continue evaluating terrain, navigating evacuees, and logging hazard pins.
              </p>
            </div>

            <div className={styles.philosophyCard}>
              <div className={styles.philosophyIcon}>
                <CheckCircle2 size={22} style={{ color: '#059669' }} />
              </div>
              <h3 className={styles.philosophyTitle}>Transparent Explainable AI (XAI)</h3>
              <p className={styles.philosophyText}>
                No black-box recommendations. Every risk score is decomposed into explicit terrain, rainfall, and
                road closure evidence so citizens and disaster authorities know exactly why a corridor is blocked.
              </p>
            </div>
          </div>
        </section>

        {/* CALL TO ACTION FOOTER BANNER */}
        <div className={styles.ctaBanner}>
          <div className={styles.ctaWatermark} aria-hidden="true">
            <Shield size={200} strokeWidth={1} />
          </div>

          <div className={styles.ctaLeft}>
            <div className={styles.ctaBadgeRow}>
              <div className={styles.ctaChip}>
                <span className={styles.pulseDot} />
                <span>MISSION READY • LIVE GRID ACTIVE</span>
              </div>
              <div className={styles.ctaTelePill}>
                <Compass size={12} />
                <span>500m Micro-Grid</span>
              </div>
            </div>

            <h2 className={styles.ctaTitle}>Experience Real-Time Disaster Intelligence</h2>
            <p className={styles.ctaSubtitle}>
              Explore the interactive 500m risk map, test on-device Snapdragon AI hazard vision, or simulate
              life-saving emergency driving routes.
            </p>

            <div className={styles.ctaFeatureTags}>
              <span className={styles.ctaFeatureTag}>
                <CheckCircle2 size={12} className={styles.checkIcon} />
                Edge AI Vision
              </span>
              <span className={styles.ctaFeatureTag}>
                <CheckCircle2 size={12} className={styles.checkIcon} />
                Dynamic Inundation Routing
              </span>
              <span className={styles.ctaFeatureTag}>
                <CheckCircle2 size={12} className={styles.checkIcon} />
                Offline Mesh Fallback
              </span>
            </div>
          </div>

          <div className={styles.ctaActions}>
            <Link to="/" className={styles.primaryCtaBtn}>
              <span>Explore Live Map</span>
              <ArrowRight size={16} />
            </Link>
            <Link to="/resq" className={styles.secondaryCtaBtn}>
              <Car size={16} />
              <span>RESQ Driving Mode</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
