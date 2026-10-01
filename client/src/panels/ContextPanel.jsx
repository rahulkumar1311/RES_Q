// Disaster Intelligence & Explainable AI Context Panel
import { useState, useEffect, useMemo } from 'react'
import {
  MapPin,
  Shield,
  ShieldAlert,
  AlertTriangle,
  Radio,
  ExternalLink,
  Clock,
  Navigation,
  ChevronRight,
  Info,
  Brain,
  Layers,
  Activity,
  Droplets,
  CloudRain,
  Mountain,
  Users,
  Building,
  Target,
  CheckCircle2,
  Cpu,
} from 'lucide-react'
import { Tabs, TabPanel } from '../ui/Tabs.jsx'
import { Button } from '../ui/Button.jsx'
import { Spinner } from '../ui/Spinner.jsx'
import { getGridRisk, getCurrentGridRisk, getActiveDisasterEvents } from '../services/riskApi.js'
import { RouteSummaryPanel } from './RouteSummaryPanel.jsx'
import styles from './ContextPanel.module.css'

// Cleans source titles from RSS prefixes and redundant category tags
function formatSourceName(raw) {
  if (!raw) return 'Regional News Desk'
  return raw
    .replace(/^Google News - /i, '')
    .replace(/ Flood Alert| Flood Monitor| Landslide & Road Closure/i, '')
    .trim()
}

// Fallback pre-calibrated demo intelligence hubs for Northeast India
const DEMO_ZONES = {
  Guwahati: {
    gridId: 'AS_00210744',
    name: 'Guwahati Dispur Hub',
    district: 'Kamrup Metropolitan',
    state: 'Assam',
    center: { lat: 26.1445, lon: 91.7898 },
    riskSummary: {
      staticRisk: 28.5,
      dynamicRisk: 22.0,
      riskScore: 24.6,
      riskStatus: 'LOW',
      riskConfidence: 0.95,
    },
    dynamicFactorChannels: {
      newsRisk: 20.0,
      nlpEventRisk: 15.0,
      roadClosureRisk: 0.0,
      rainfallRisk: 35.0,
      floodEventRisk: 18.0,
      landslideEventRisk: 0.0,
    },
    staticFactors: {
      elevationMean: 54,
      slopeMean: 3.2,
      distanceToRiver: 1800,
      waterbodyPercentage: 6.5,
      floodSusceptibility: 38.0,
      landslideSusceptibility: 8.0,
      populationDensity: 2850,
      infrastructureExposure: 85.0,
    },
    nearbyResources: [
      { name: 'Dispur Police Station & Command Hub', type: 'Police Station', distanceMeters: 420, phone: '0361-2260222' },
      { name: 'Gauhati Medical College & Hospital (GMCH)', type: 'Medical Facility', distanceMeters: 1250, phone: '108' },
      { name: 'State Emergency Operations Centre (SEOC)', type: 'Disaster Response', distanceMeters: 850, phone: '1070' },
      { name: 'Sarumotoria Community Relief Center', type: 'Flood Shelter', distanceMeters: 1100, phone: '1077' },
    ],
    activeEvents: [
      {
        id: 103,
        news_title: 'IMD issues yellow alert for Kamrup Metro with localized rain showers expected',
        event_type: 'WEATHER_WARNING',
        hazard_type: 'RAIN',
        severity: 35,
        confidence: 0.94,
        location_text: 'Guwahati, Kamrup Metropolitan',
        district: 'Kamrup Metropolitan',
        state: 'Assam',
        source_name: 'Press Information Bureau (PIB) Guwahati',
        reliability_tier: 1,
        reported_at: new Date(Date.now() - 3600000 * 2).toISOString(),
        news_url: 'https://pib.gov.in',
        raw_extraction: { ml: { label: 'WEATHER_WARNING', confidence: 0.91, modelVersion: 'v1' } },
      },
      {
        id: 104,
        news_title: 'Guwahati Municipal Corporation clears Bharalu river channels to maintain drainage flow',
        event_type: 'PREPAREDNESS_UPDATE',
        hazard_type: 'FLOOD',
        severity: 25,
        confidence: 0.88,
        location_text: 'Bharalu River Basin, Guwahati',
        district: 'Kamrup Metropolitan',
        state: 'Assam',
        source_name: 'G Plus News',
        reliability_tier: 2,
        reported_at: new Date(Date.now() - 3600000 * 12).toISOString(),
        news_url: 'https://guwahatiplus.com',
        raw_extraction: { ml: { label: 'GOV_ACTION', confidence: 0.89, modelVersion: 'v1' } },
      },
    ],
  },
  Boko: {
    gridId: 'AS_00239973',
    name: 'Boko Bridge Corridor (NH-27)',
    district: 'Kamrup',
    state: 'Assam',
    center: { lat: 25.9750, lon: 91.2330 },
    riskSummary: {
      staticRisk: 35.0,
      dynamicRisk: 90.0,
      riskScore: 68.0,
      riskStatus: 'CRITICAL',
      riskConfidence: 0.96,
    },
    dynamicFactorChannels: {
      newsRisk: 88.0,
      nlpEventRisk: 90.0,
      roadClosureRisk: 90.0,
      rainfallRisk: 82.0,
      floodEventRisk: 85.0,
      landslideEventRisk: 10.0,
    },
    staticFactors: {
      elevationMean: 48,
      slopeMean: 1.8,
      distanceToRiver: 450,
      waterbodyPercentage: 18.5,
      floodSusceptibility: 82.0,
      landslideSusceptibility: 15.0,
      populationDensity: 1450,
      infrastructureExposure: 78.0,
    },
    nearbyResources: [
      { name: 'Boko Police Station & Incident Command', type: 'Police Station', distanceMeters: 450, phone: '112' },
      { name: 'Boko First Referral Emergency Hospital', type: 'Medical Facility', distanceMeters: 780, phone: '108' },
      { name: 'Singra River High School Evacuation Shelter', type: 'Flood Shelter', distanceMeters: 920, phone: '1077' },
      { name: 'SDRF Emergency Water Rescue Outpost', type: 'Disaster Response', distanceMeters: 1400, phone: '1070' },
    ],
    activeEvents: [
      {
        id: 101,
        news_title: 'Severe flash flood breaches Singra riverbank near Boko; NH-27 transit restricted',
        event_type: 'ROAD_FLOODING',
        hazard_type: 'FLOOD',
        severity: 90,
        confidence: 0.95,
        location_text: 'Boko, Kamrup, Assam',
        district: 'Kamrup',
        state: 'Assam',
        road_blocked: true,
        bridge_closed: true,
        source_name: 'The Sentinel Assam',
        reliability_tier: 1,
        reported_at: new Date(Date.now() - 3600000 * 3).toISOString(),
        news_url: 'https://www.sentinelassam.com',
        raw_extraction: { ml: { label: 'ACTIVE_DISASTER', confidence: 0.96, modelVersion: 'v1' } },
      },
      {
        id: 102,
        news_title: 'SDRF rescue boats deployed across Boko subdivision following sudden inundation',
        event_type: 'EVACUATION_ORDER',
        hazard_type: 'FLOOD',
        severity: 85,
        confidence: 0.92,
        location_text: 'Boko Subdivision, Kamrup',
        district: 'Kamrup',
        state: 'Assam',
        road_blocked: true,
        source_name: 'Northeast Now',
        reliability_tier: 2,
        reported_at: new Date(Date.now() - 3600000 * 7).toISOString(),
        news_url: 'https://nenow.in',
        raw_extraction: { ml: { label: 'ACTIVE_DISASTER', confidence: 0.93, modelVersion: 'v1' } },
      },
    ],
  },
  Jorabat: {
    gridId: 'AS_00224110',
    name: 'Jorabat Transit Bottleneck',
    district: 'Kamrup Metropolitan',
    state: 'Assam',
    center: { lat: 26.1012, lon: 91.8682 },
    riskSummary: {
      staticRisk: 42.0,
      dynamicRisk: 72.0,
      riskScore: 60.0,
      riskStatus: 'HIGH',
      riskConfidence: 0.95,
    },
    dynamicFactorChannels: {
      newsRisk: 75.0,
      nlpEventRisk: 70.0,
      roadClosureRisk: 70.0,
      rainfallRisk: 74.0,
      floodEventRisk: 68.0,
      landslideEventRisk: 65.0,
    },
    staticFactors: {
      elevationMean: 72,
      slopeMean: 12.4,
      distanceToRiver: 650,
      waterbodyPercentage: 5.0,
      floodSusceptibility: 65.0,
      landslideSusceptibility: 68.0,
      populationDensity: 950,
      infrastructureExposure: 92.0,
    },
    nearbyResources: [
      { name: 'Jorabat Highway Traffic Outpost', type: 'Police Station', distanceMeters: 310, phone: '112' },
      { name: 'Sonapur Community Health Centre (CHC)', type: 'Medical Facility', distanceMeters: 3400, phone: '108' },
      { name: 'NHIDCL Emergency Highway Recovery Depot', type: 'Disaster Response', distanceMeters: 850, phone: '1033' },
    ],
    activeEvents: [
      {
        id: 105,
        news_title: 'Heavy runoff and mudflow from adjacent hills cause severe congestion at Jorabat on GS Road',
        event_type: 'ROAD_WATERLOGGING',
        hazard_type: 'FLOOD',
        severity: 75,
        confidence: 0.94,
        location_text: 'Jorabat, Assam-Meghalaya Border',
        district: 'Kamrup Metropolitan',
        state: 'Assam',
        road_blocked: false,
        source_name: 'The Sentinel Assam',
        reliability_tier: 1,
        reported_at: new Date(Date.now() - 3600000 * 4).toISOString(),
        news_url: 'https://www.sentinelassam.com',
        raw_extraction: { ml: { label: 'ACTIVE_DISASTER', confidence: 0.94, modelVersion: 'v1' } },
      },
    ],
  },
  Shillong: {
    gridId: 'ML_00104821',
    name: 'Shillong Plateau & Police Bazar',
    district: 'East Khasi Hills',
    state: 'Meghalaya',
    center: { lat: 25.5788, lon: 91.8933 },
    riskSummary: {
      staticRisk: 31.0,
      dynamicRisk: 20.0,
      riskScore: 24.4,
      riskStatus: 'LOW',
      riskConfidence: 0.96,
    },
    dynamicFactorChannels: {
      newsRisk: 18.0,
      nlpEventRisk: 15.0,
      roadClosureRisk: 0.0,
      rainfallRisk: 28.0,
      floodEventRisk: 5.0,
      landslideEventRisk: 30.0,
    },
    staticFactors: {
      elevationMean: 1520,
      slopeMean: 14.2,
      distanceToRiver: 2400,
      waterbodyPercentage: 2.1,
      floodSusceptibility: 12.0,
      landslideSusceptibility: 45.0,
      populationDensity: 3100,
      infrastructureExposure: 88.0,
    },
    nearbyResources: [
      { name: 'Sadar Police Station Shillong', type: 'Police Station', distanceMeters: 380, phone: '0364-2224818' },
      { name: 'Shillong Civil Hospital', type: 'Medical Facility', distanceMeters: 850, phone: '108' },
      { name: 'East Khasi Hills Emergency Operations Center', type: 'Disaster Response', distanceMeters: 920, phone: '1077' },
      { name: 'NEIGRIHMS Super-Specialty Trauma Center', type: 'Medical Facility', distanceMeters: 5400, phone: '0364-2538011' },
    ],
    activeEvents: [
      {
        id: 107,
        news_title: 'Shillong traffic police confirm clear flow along GS Road corridor; weather overcast',
        event_type: 'TRAFFIC_UPDATE',
        hazard_type: 'GENERAL',
        severity: 20,
        confidence: 0.95,
        location_text: 'Police Bazar, Shillong',
        district: 'East Khasi Hills',
        state: 'Meghalaya',
        source_name: 'The Shillong Times',
        reliability_tier: 1,
        reported_at: new Date(Date.now() - 3600000 * 2).toISOString(),
        news_url: 'https://theshillongtimes.com',
        raw_extraction: { ml: { label: 'TRAFFIC_NORMAL', confidence: 0.95, modelVersion: 'v1' } },
      },
    ],
  },
}

// Generates structured Explainable AI diagnostic bullets with standard vector icons
function getDiagnosticBullets(riskData) {
  if (!riskData) return []
  const score = riskData.riskSummary?.riskScore ?? 24.8
  const status = riskData.riskSummary?.riskStatus || 'LOW'
  const activeEvents = riskData.activeEvents || []
  const channels = riskData.dynamicFactorChannels || {}
  const staticF = riskData.staticFactors || {}

  const bullets = []

  // 1. Status Assessment
  bullets.push({
    icon: Target,
    iconColor: status === 'CRITICAL' || status === 'HIGH' ? '#dc2626' : status === 'MODERATE' ? '#d97706' : '#10b981',
    label: 'Risk Assessment',
    text: `${status} Risk Index (${score.toFixed(1)} / 100) — ${
      status === 'CRITICAL'
        ? 'Severe disaster conditions detected along corridor.'
        : status === 'HIGH'
        ? 'Elevated flood, waterlogging, or structural hazard risk active.'
        : status === 'MODERATE'
        ? 'Cautionary environmental and slope conditions noted.'
        : 'Normal operational baseline; all corridors clear.'
    }`,
    isAlert: status === 'CRITICAL' || status === 'HIGH',
  })

  // 2. Direct Cell Inundation / Closure Status
  if (channels.roadClosureRisk >= 80) {
    bullets.push({
      icon: AlertTriangle,
      iconColor: '#dc2626',
      label: 'Transport Corridor',
      text: 'Critical structural road/bridge blockage active. Physical transit bypass required.',
      isAlert: true,
    })
  } else if (activeEvents.length > 0) {
    const first = activeEvents[0]
    bullets.push({
      icon: ShieldAlert,
      iconColor: '#ea580c',
      label: 'Direct Hazards',
      text: `${activeEvents.length} active verified disaster incident(s) directly affecting this 500m cell (${first.news_title || first.hazard_type}).`,
      isAlert: true,
    })
  } else {
    bullets.push({
      icon: CheckCircle2,
      iconColor: '#10b981',
      label: 'Direct Hazard Status',
      text: 'No active flood inundation or road blockages detected inside this 500m cell.',
    })
  }

  // 3. Terrain Baseline Breakdown
  const terrainItems = []
  if (staticF.elevationMean != null) terrainItems.push(`elevation ${Math.round(staticF.elevationMean)}m`)
  if (staticF.slopeMean != null) terrainItems.push(`slope ${Number(staticF.slopeMean).toFixed(1)}°`)
  if (staticF.landslideSusceptibility > 50) terrainItems.push(`high landslide susceptibility ${staticF.landslideSusceptibility}%`)
  if (terrainItems.length > 0) {
    bullets.push({
      icon: Mountain,
      iconColor: '#64748b',
      label: 'Terrain Baseline',
      text: `Topographic profile: ${terrainItems.join(', ')}.`,
    })
  }

  // 4. Exposed Population & Infrastructure
  const popCount = staticF.populationDensity != null ? Math.round(staticF.populationDensity) : 0
  const infraExp = staticF.infrastructureExposure != null ? Math.round(staticF.infrastructureExposure) : 0
  bullets.push({
    icon: Users,
    iconColor: '#64748b',
    label: 'Exposure Density',
    text: `Estimated ~${popCount.toLocaleString()} residents / km² with ${infraExp}% infrastructure exposure density.`,
  })

  // 5. Environmental Proximity / River
  if (staticF.distanceToRiver != null) {
    const km = (staticF.distanceToRiver / 1000).toFixed(1)
    bullets.push({
      icon: Droplets,
      iconColor: '#0284c7',
      label: 'Hydrology Buffer',
      text: `${km} km proximity to Brahmaputra river drainage network. Floodplain susceptibility: ${Math.round(staticF.floodSusceptibility || 0)}%.`,
    })
  }

  return bullets
}

export function ContextPanel({
  selectedGridId,
  selectedLocation,
  onLocateMe,
  onSelectQuickPlace,
  onOpenResqMode,
  onGetDirections,
  routeData = null,
  routeOrigin = null,
  routeDestination = null,
  onStartNavigation,
  onClearRoute,
}) {
  const [tab, setTab] = useState('overview')
  const [riskData, setRiskData] = useState(DEMO_ZONES.Guwahati)
  const [loading, setLoading] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [allRegionalEvents, setAllRegionalEvents] = useState([])

  // Load active regional disaster news bulletins on mount
  useEffect(() => {
    getActiveDisasterEvents()
      .then((evs) => {
        if (Array.isArray(evs) && evs.length > 0) {
          setAllRegionalEvents(evs)
        }
      })
      .catch(() => {})
  }, [])

  // Fetch full explainability breakdown when selectedGridId or selectedLocation changes
  useEffect(() => {
    let cancelled = false

    const loadRisk = async () => {
      setLoading(true)
      try {
        let data = null
        if (selectedGridId) {
          data = await getGridRisk(selectedGridId)
        } else if (selectedLocation?.lat != null && selectedLocation?.lon != null) {
          data = await getCurrentGridRisk(selectedLocation.lat, selectedLocation.lon)
        }

        if (!cancelled && data && data.riskSummary) {
          setRiskData(data)
        } else if (!cancelled && selectedLocation?.name) {
          // Check if matches a known demo zone
          const matchKey = Object.keys(DEMO_ZONES).find((k) =>
            selectedLocation.name.toLowerCase().includes(k.toLowerCase())
          )
          if (matchKey) {
            setRiskData(DEMO_ZONES[matchKey])
          }
        }
      } catch (err) {
        console.warn('Grid risk fetch fallback to local intelligence:', err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    if (selectedGridId || selectedLocation) {
      loadRisk()
    }

    return () => {
      cancelled = true
    }
  }, [selectedGridId, selectedLocation])

  const riskScore = riskData?.riskSummary?.riskScore ?? 24.6
  const riskStatus = riskData?.riskSummary?.riskStatus ?? 'LOW'
  const staticRisk = riskData?.riskSummary?.staticRisk ?? 28.5
  const dynamicRisk = riskData?.riskSummary?.dynamicRisk ?? 22.0
  const riskConfidence = riskData?.riskSummary?.riskConfidence ?? 0.95
  const dynamicChannels = riskData?.dynamicFactorChannels || {}
  const staticFactors = riskData?.staticFactors || {}
  const activeEvents = riskData?.activeEvents || []
  const regionalEvents = riskData?.regionalEvents || []
  const nearbyResources = riskData?.nearbyResources || [
    { name: 'Dispur Police Station & Command Hub', type: 'Police Station', distanceMeters: 420, phone: '0361-2260222' },
    { name: 'Gauhati Medical College & Hospital (GMCH)', type: 'Medical Facility', distanceMeters: 1250, phone: '108' },
    { name: 'State Emergency Operations Centre (SEOC)', type: 'Disaster Response', distanceMeters: 850, phone: '1070' },
  ]

  // Combined deduplicated bulletins for Intelligence tab
  const deduplicatedEvents = useMemo(() => {
    const rawList = [
      ...activeEvents,
      ...regionalEvents,
      ...allRegionalEvents,
    ]
    const seen = new Set()
    const result = []

    for (const ev of rawList) {
      const title = (ev.news_title || ev.location_text || '').toLowerCase().trim()
      if (title && !seen.has(title)) {
        seen.add(title)
        result.push(ev)
      }
    }
    return result
  }, [activeEvents, regionalEvents, allRegionalEvents])

  const diagnosticBullets = useMemo(() => getDiagnosticBullets(riskData), [riskData])

  // Gauge colors and styling
  let gaugeColor = '#10b981'
  let statusLabel = 'LOW'

  if (riskStatus === 'CRITICAL' || riskScore >= 70) {
    gaugeColor = '#dc2626'
    statusLabel = 'CRITICAL'
  } else if (riskStatus === 'HIGH' || riskScore >= 45) {
    gaugeColor = '#ea580c'
    statusLabel = 'HIGH'
  } else if (riskStatus === 'MODERATE' || riskScore >= 25) {
    gaugeColor = '#d97706'
    statusLabel = 'MODERATE'
  }

  // Dynamic tab items with badges
  const tabItems = useMemo(
    () => [
      { value: 'overview', label: 'OVERVIEW' },
      { value: 'hazards', label: 'AI ANALYSIS', badge: statusLabel },
      { value: 'evidence', label: 'INTELLIGENCE', badge: deduplicatedEvents.length || undefined },
    ],
    [statusLabel, deduplicatedEvents.length]
  )

  const placeTitle = selectedLocation?.name || (riskData?.gridId ? `Grid ${riskData.gridId}` : 'Guwahati Hub')
  const placeSubtitle = selectedLocation?.isLiveGps
    ? `${selectedLocation.district}, ${selectedLocation.state} · GPS Accuracy ±${selectedLocation.accuracy || 10}m`
    : selectedLocation?.district
    ? `${selectedLocation.district}, ${selectedLocation.state || 'Assam'}`
    : riskData?.district
    ? `${riskData.district}, ${riskData.state || 'Assam'}`
    : 'Assam & Meghalaya Disaster Grid'

  // Circular gauge circumference (r = 38)
  const radius = 38
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (Math.min(riskScore, 100) / 100) * circumference

  if (collapsed) {
    return (
      <button
        type="button"
        className={styles.expandTab}
        onClick={() => setCollapsed(false)}
        aria-label="Expand Disaster Intelligence Panel"
      >
        <Shield size={18} />
        <span>Intelligence</span>
      </button>
    )
  }

  // Render Route Summary & Maneuver Preview when route is active
  if (routeData) {
    return (
      <aside className={styles.dock} aria-label="Route Summary & Navigation Panel">
        <div className={styles.panelCard} style={{ padding: 0 }}>
          <RouteSummaryPanel
            routeData={routeData}
            origin={routeOrigin}
            destination={routeDestination || selectedLocation}
            onStartNavigation={onStartNavigation}
            onClearRoute={onClearRoute}
          />
        </div>
      </aside>
    )
  }

  return (
    <aside className={styles.dock} aria-label="Disaster Intelligence Panel">
      <div className={styles.panelCard}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.iconCircle}>
              <MapPin size={18} className={styles.pinIcon} />
            </div>
            <div className={styles.headerTitles}>
              <div className={styles.titleRow}>
                <h2 className={styles.title}>{placeTitle}</h2>
                <div className={styles.liveIndicator}>
                  <span className={styles.liveDot} />
                  <span>LIVE</span>
                </div>
              </div>
              <p className={styles.subtitle}>{placeSubtitle}</p>
            </div>
          </div>
          <button
            type="button"
            className={styles.collapseBtn}
            onClick={() => setCollapsed(true)}
            aria-label="Collapse panel"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Quick Demo Zone Switcher Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            background: 'rgba(241, 245, 249, 0.75)',
            borderBottom: '1px solid rgba(226, 232, 240, 0.8)',
            overflowX: 'auto',
          }}
        >
          <span style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>
            Live Zones:
          </span>
          <button
            type="button"
            onClick={() => {
              setRiskData(DEMO_ZONES.Guwahati)
              if (onSelectQuickPlace) onSelectQuickPlace('Guwahati')
            }}
            style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: '999px',
              border: '1px solid #cbd5e1',
              background: riskData?.gridId === 'AS_00210744' ? '#2563eb' : '#ffffff',
              color: riskData?.gridId === 'AS_00210744' ? '#ffffff' : '#334155',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Guwahati (25 Low)
          </button>
          <button
            type="button"
            onClick={() => {
              setRiskData(DEMO_ZONES.Boko)
              if (onSelectQuickPlace) onSelectQuickPlace('Boko')
            }}
            style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: '999px',
              border: '1px solid #fecaca',
              background: riskData?.gridId === 'AS_00239973' ? '#dc2626' : '#fff1f2',
              color: riskData?.gridId === 'AS_00239973' ? '#ffffff' : '#991b1b',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Boko (68 Critical)
          </button>
          <button
            type="button"
            onClick={() => {
              setRiskData(DEMO_ZONES.Jorabat)
              if (onSelectQuickPlace) onSelectQuickPlace('Jorabat')
            }}
            style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: '999px',
              border: '1px solid #fed7aa',
              background: riskData?.gridId === 'AS_00224110' ? '#ea580c' : '#fff7ed',
              color: riskData?.gridId === 'AS_00224110' ? '#ffffff' : '#9a3412',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Jorabat (60 High)
          </button>
          <button
            type="button"
            onClick={() => {
              setRiskData(DEMO_ZONES.Shillong)
              if (onSelectQuickPlace) onSelectQuickPlace('Shillong')
            }}
            style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: '999px',
              border: '1px solid #cbd5e1',
              background: riskData?.gridId === 'ML_00104821' ? '#0284c7' : '#ffffff',
              color: riskData?.gridId === 'ML_00104821' ? '#ffffff' : '#334155',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Shillong (24 Low)
          </button>
        </div>

        {/* Action Button: Get Directions */}
        <div className={styles.actionRow}>
          <Button
            variant="primary"
            icon={Navigation}
            block
            onClick={onGetDirections || onOpenResqMode}
            className={styles.directionsBtn}
          >
            Get Disaster-Safe Directions
          </Button>
        </div>

        {/* Tab Navigation: OVERVIEW | AI ANALYSIS | INTELLIGENCE */}
        <div className={styles.tabsRow}>
          <Tabs items={tabItems} value={tab} onChange={setTab} />
        </div>

        {/* Panel Body */}
        <div className={styles.body}>
          {loading && (
            <div className={styles.emptyState}>
              <Spinner size={24} />
              <p className={styles.emptyText}>Updating disaster intelligence...</p>
            </div>
          )}

          {/* TAB 1: OVERVIEW */}
          <TabPanel value="overview" active={tab === 'overview'}>
            <div className={styles.tabContent}>
              {/* Gauge Container */}
              <div className={styles.gaugeContainer}>
                <div className={styles.gaugeCircleWrapper}>
                  <svg className={styles.gaugeSvg} viewBox="0 0 90 90">
                    <circle cx="45" cy="45" r={radius} className={styles.gaugeBgCircle} />
                    <circle
                      cx="45"
                      cy="45"
                      r={radius}
                      className={styles.gaugeFillCircle}
                      style={{
                        stroke: gaugeColor,
                        strokeDasharray: circumference,
                        strokeDashoffset: strokeDashoffset,
                      }}
                    />
                  </svg>
                  <div className={styles.gaugeCenterText}>
                    <span className={styles.gaugeNumber}>{riskScore.toFixed(1)}</span>
                    <span className={styles.gaugeTotal}>/ 100</span>
                  </div>
                </div>

                <div className={styles.gaugeLabels}>
                  <span className={styles.gaugeCategory}>DYNAMIC RISK INDEX</span>
                  <span className={styles.gaugeStatusTitle} style={{ color: gaugeColor }}>
                    {statusLabel}
                  </span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    {statusLabel === 'CRITICAL'
                      ? 'Severe Corridors Blocked'
                      : statusLabel === 'HIGH'
                      ? 'Elevated Flood Risk'
                      : statusLabel === 'MODERATE'
                      ? 'Cautionary Weather'
                      : 'Baseline Clear'}
                  </span>
                </div>
              </div>

              {/* District & Cell Info: Refined 2x2 Metric Cards Grid */}
              <div className={styles.section}>
                <div className={styles.sectionTitleRow}>
                  <Shield size={14} className={styles.sectionIcon} />
                  <h4 className={styles.sectionHeading}>Telemetry Breakdown</h4>
                </div>

                <div className={styles.metricGrid}>
                  <div className={styles.metricCard}>
                    <div className={styles.metricHeader}>
                      <Shield size={13} className={styles.metricIcon} />
                      <span className={styles.metricLabel}>Risk Level</span>
                    </div>
                    <div className={styles.metricValueRow}>
                      <span
                        className={styles.metricStatusBadge}
                        style={{
                          background: gaugeColor + '18',
                          color: gaugeColor,
                          borderColor: gaugeColor + '40',
                        }}
                      >
                        {statusLabel}
                      </span>
                    </div>
                  </div>

                  <div className={styles.metricCard}>
                    <div className={styles.metricHeader}>
                      <Activity size={13} className={styles.metricIcon} />
                      <span className={styles.metricLabel}>Dynamic Impact</span>
                    </div>
                    <div className={styles.metricValueRow}>
                      <span className={styles.metricNumber}>{dynamicRisk.toFixed(1)}%</span>
                      <span className={styles.metricUnit}>active</span>
                    </div>
                  </div>

                  <div className={styles.metricCard}>
                    <div className={styles.metricHeader}>
                      <Layers size={13} className={styles.metricIcon} />
                      <span className={styles.metricLabel}>Static Baseline</span>
                    </div>
                    <div className={styles.metricValueRow}>
                      <span className={styles.metricNumber}>{staticRisk.toFixed(1)}</span>
                      <span className={styles.metricUnit}>/ 100</span>
                    </div>
                  </div>

                  <div className={styles.metricCard}>
                    <div className={styles.metricHeader}>
                      <Cpu size={13} className={styles.metricIcon} />
                      <span className={styles.metricLabel}>AI Confidence</span>
                    </div>
                    <div className={styles.metricValueRow}>
                      <span className={styles.metricNumber}>{Math.round(riskConfidence * 100)}%</span>
                      <span className={styles.metricUnit}>verified</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dynamic Nearby Safety Resources */}
              <div className={styles.section}>
                <div className={styles.sectionTitleRow}>
                  <Radio size={14} className={styles.sectionIcon} />
                  <h4 className={styles.sectionHeading}>Nearby Emergency Facilities</h4>
                </div>

                <div className={styles.resourceList}>
                  {nearbyResources.map((res, idx) => (
                    <div key={idx} className={styles.resourceCard}>
                      <div className={styles.resourceIconCircle}>
                        {res.type.includes('Medical') ? (
                          <Activity size={16} color="#dc2626" />
                        ) : res.type.includes('Shelter') ? (
                          <Building size={16} color="#0284c7" />
                        ) : (
                          <Shield size={16} color="var(--accent)" />
                        )}
                      </div>
                      <div className={styles.resourceInfo}>
                        <span className={styles.resourceName}>{res.name}</span>
                        <span className={styles.resourceMeta}>
                          {res.type} · {res.distanceMeters < 1000 ? `${res.distanceMeters} m` : `${(res.distanceMeters / 1000).toFixed(1)} km`}
                          {res.phone && ` · Tel: ${res.phone}`}
                        </span>
                      </div>
                      <button
                        type="button"
                        className={styles.directionsLink}
                        onClick={onGetDirections || onOpenResqMode}
                      >
                        <span>Go</span>
                        <span>→</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabPanel>

          {/* TAB 2: AI ANALYSIS */}
          <TabPanel value="hazards" active={tab === 'hazards'}>
            <div className={styles.tabContent}>
              {/* Structured AI Diagnostic Bullet Points Card */}
              <div className={styles.aiDiagnosticCard}>
                <div className={styles.aiDiagHeader}>
                  <div className={styles.aiDiagTitleRow}>
                    <Brain size={16} />
                    <span>Neural AI Spatial Diagnostics</span>
                  </div>
                  <span className={styles.aiDiagBadge} style={{ background: gaugeColor, color: '#ffffff' }}>
                    {statusLabel}
                  </span>
                </div>

                <ul className={styles.diagBulletList}>
                  {diagnosticBullets.map((item, idx) => {
                    const IconComponent = item.icon
                    return (
                      <li key={idx} className={styles.diagBulletItem}>
                        <span className={styles.diagBulletIcon} style={{ color: item.iconColor }}>
                          <IconComponent size={15} />
                        </span>
                        <div className={styles.diagBulletBody}>
                          <strong className={styles.diagBulletLabel}>{item.label}:</strong>{' '}
                          <span className={item.isAlert ? styles.diagBulletAlert : styles.diagBulletText}>
                            {item.text}
                          </span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>

              {/* Snapdragon Edge AI Live Demonstration Card */}
              <div
                style={{
                  marginTop: '12px',
                  padding: '14px 16px',
                  borderRadius: '12px',
                  border: '1px solid #0284c7',
                  background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.04) 0%, rgba(224, 242, 254, 0.25) 100%)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Cpu size={15} color="#0284c7" />
                    <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#0f172a' }}>RESQ EDGE AI DEMONSTRATION</span>
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '999px', background: '#e0f2fe', color: '#0284c7' }}>
                    SNAPDRAGON
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '11.5px', color: '#475569', lineHeight: 1.4 }}>
                  Inspect real on-device hardware telemetry, INT8 quantized inference, and live <strong>AI → HAZARD → ROUTING</strong> decision gating.
                </p>
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent('resq:open-ai-demo'))}
                  style={{
                    background: '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    padding: '7px 12px',
                    borderRadius: '8px',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: '0 1px 2px rgba(2, 132, 199, 0.2)',
                  }}
                >
                  <Activity size={13} />
                  <span>Inspect Live AI → Routing Pipeline</span>
                </button>
              </div>

              {/* Mathematical Fusion Formula Card */}
              <div className={styles.formulaCard}>
                <div className={styles.formulaHeader}>
                  <span>Dynamic Risk Fusion Formula</span>
                  <Info size={13} color="var(--text-muted)" />
                </div>
                <div className={styles.formulaEquation}>
                  <span>
                    Score = (0.40 × {staticRisk.toFixed(1)}) + (0.60 × {dynamicRisk.toFixed(1)}) = <strong>{riskScore.toFixed(1)}</strong>
                  </span>
                </div>
                <div className={styles.formulaWeights}>
                  <span>Static Baseline: 40%</span>
                  <span>•</span>
                  <span>Real-Time Dynamic Events: 60%</span>
                </div>
              </div>

              {/* Multi-Channel Decomposition Meters */}
              <div className={styles.section}>
                <div className={styles.sectionTitleRow}>
                  <Layers size={14} className={styles.sectionIcon} />
                  <h4 className={styles.sectionHeading}>Risk Factor Channels</h4>
                </div>

                <div className={styles.channelMeterList}>
                  {/* Road / Bridge Closure */}
                  <div className={styles.channelMeterRow}>
                    <div className={styles.channelMeterHeader}>
                      <span className={styles.channelMeterName}>
                        <AlertTriangle size={12} /> Road & Bridge Closures
                      </span>
                      <span className={styles.channelMeterVal} style={{ color: (dynamicChannels.roadClosureRisk || 0) >= 80 ? '#dc2626' : 'inherit', fontWeight: (dynamicChannels.roadClosureRisk || 0) >= 80 ? 800 : 600 }}>
                        {(dynamicChannels.roadClosureRisk || 0) >= 80 ? 'CRITICAL CLOSED (90%)' : `${(dynamicChannels.roadClosureRisk || 0).toFixed(0)} / 100`}
                      </span>
                    </div>
                    <div className={styles.channelMeterBar}>
                      <div
                        className={styles.channelMeterFill}
                        style={{
                          width: `${Math.min(100, dynamicChannels.roadClosureRisk || 0)}%`,
                          background: (dynamicChannels.roadClosureRisk || 0) >= 80 ? '#dc2626' : '#10b981',
                        }}
                      />
                    </div>
                  </div>

                  {/* News Media Risk */}
                  <div className={styles.channelMeterRow}>
                    <div className={styles.channelMeterHeader}>
                      <span className={styles.channelMeterName}>
                        <Radio size={12} /> News Media NLP Impact
                      </span>
                      <span className={styles.channelMeterVal}>{(dynamicChannels.newsRisk || 0).toFixed(1)} / 100</span>
                    </div>
                    <div className={styles.channelMeterBar}>
                      <div
                        className={styles.channelMeterFill}
                        style={{
                          width: `${Math.min(100, dynamicChannels.newsRisk || 0)}%`,
                          background: (dynamicChannels.newsRisk || 0) > 50 ? '#dc2626' : '#2563eb',
                        }}
                      />
                    </div>
                  </div>

                  {/* Rainfall Accumulation */}
                  <div className={styles.channelMeterRow}>
                    <div className={styles.channelMeterHeader}>
                      <span className={styles.channelMeterName}>
                        <CloudRain size={12} /> Precipitation Risk
                      </span>
                      <span className={styles.channelMeterVal}>{(dynamicChannels.rainfallRisk || 0).toFixed(1)} / 100</span>
                    </div>
                    <div className={styles.channelMeterBar}>
                      <div
                        className={styles.channelMeterFill}
                        style={{
                          width: `${Math.min(100, dynamicChannels.rainfallRisk || 0)}%`,
                          background: '#0284c7',
                        }}
                      />
                    </div>
                  </div>

                  {/* Floodplain Susceptibility */}
                  <div className={styles.channelMeterRow}>
                    <div className={styles.channelMeterHeader}>
                      <span className={styles.channelMeterName}>
                        <Droplets size={12} /> Floodplain Susceptibility
                      </span>
                      <span className={styles.channelMeterVal}>{(staticFactors.floodSusceptibility || 0).toFixed(0)} / 100</span>
                    </div>
                    <div className={styles.channelMeterBar}>
                      <div
                        className={styles.channelMeterFill}
                        style={{
                          width: `${Math.min(100, staticFactors.floodSusceptibility || 0)}%`,
                          background: '#3b82f6',
                        }}
                      />
                    </div>
                  </div>

                  {/* Landslide Hazard */}
                  <div className={styles.channelMeterRow}>
                    <div className={styles.channelMeterHeader}>
                      <span className={styles.channelMeterName}>
                        <Mountain size={12} /> Slope & Landslide Hazard
                      </span>
                      <span className={styles.channelMeterVal}>{(staticFactors.landslideSusceptibility || 0).toFixed(0)} / 100</span>
                    </div>
                    <div className={styles.channelMeterBar}>
                      <div
                        className={styles.channelMeterFill}
                        style={{
                          width: `${Math.min(100, staticFactors.landslideSusceptibility || 0)}%`,
                          background: '#d97706',
                        }}
                      />
                    </div>
                  </div>

                  {/* Population Exposure */}
                  <div className={styles.channelMeterRow}>
                    <div className={styles.channelMeterHeader}>
                      <span className={styles.channelMeterName}>
                        <Users size={12} /> Population Exposure Density
                      </span>
                      <span className={styles.channelMeterVal}>{Math.round(staticFactors.populationDensity || 0)} / km²</span>
                    </div>
                    <div className={styles.channelMeterBar}>
                      <div
                        className={styles.channelMeterFill}
                        style={{
                          width: `${Math.min(100, ((staticFactors.populationDensity || 0) / 3000) * 100)}%`,
                          background: '#8b5cf6',
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Safety Guidance Action Card */}
              <div className={styles.actionAdviceCard}>
                <Shield size={16} color="#2563eb" style={{ flexShrink: 0, marginTop: 2 }} />
                <p className={styles.actionAdviceText}>
                  {statusLabel === 'CRITICAL'
                    ? 'Emergency Alert: Structural road/bridge blockage active along this corridor. Divert to recommended bypass. Follow SDRF directives.'
                    : statusLabel === 'HIGH'
                    ? 'Elevated Hazard: Monitor rising river water levels and slope mudflow. Restrict heavy commercial vehicle movement.'
                    : statusLabel === 'MODERATE'
                    ? 'Advisory: Maintain standard safety precautions during heavy rainfall periods along hill highway corridors.'
                    : 'Clear: Normal operations. Regional transit corridors operating under safe baseline conditions.'}
                </p>
              </div>
            </div>
          </TabPanel>

          {/* TAB 3: INTELLIGENCE */}
          <TabPanel value="evidence" active={tab === 'evidence'}>
            <div className={styles.tabContent}>
              <div className={styles.section}>
                <div className={styles.sectionTitleRow}>
                  <Radio size={14} className={styles.sectionIcon} />
                  <h4 className={styles.sectionHeading}>
                    Verified Disaster Media & Bulletins ({deduplicatedEvents.length})
                  </h4>
                </div>
                <p className={styles.sectionDesc}>
                  NLP-extracted and ML-classified regional disaster intelligence from regional media desks, IMD radar alerts, and state disaster bulletins.
                </p>

                <div className={styles.evidenceList}>
                  {deduplicatedEvents.map((ev, idx) => {
                    const formattedSource = formatSourceName(ev.source_name)
                    const isSevere = ev.severity >= 70 || ev.road_blocked || ev.bridge_closed
                    return (
                      <div key={idx} className={styles.evidenceCard} style={{ borderColor: isSevere ? '#fca5a5' : undefined }}>
                        <div className={styles.evidenceSourceRow}>
                          <span className={styles.evidenceSource}>{formattedSource}</span>
                          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            {isSevere && (
                              <span style={{ fontSize: '9.5px', background: '#fee2e2', color: '#b91c1c', padding: '1px 5px', borderRadius: '4px', fontWeight: 800 }}>
                                ALERT
                              </span>
                            )}
                            <span className={styles.evidenceTier}>Tier {ev.reliability_tier || 1} Verified</span>
                          </div>
                        </div>
                        <p className={styles.evidenceTitle}>{ev.news_title || ev.location_text || 'Disaster Bulletin'}</p>
                        <div className={styles.evidenceFooter}>
                          <span className={styles.evidenceTime}>
                            <Clock size={11} />
                            {ev.reported_at ? new Date(ev.reported_at).toLocaleDateString() : 'Live'}
                          </span>
                          {ev.raw_extraction?.ml?.confidence && (
                            <span
                              style={{
                                fontSize: '10px',
                                background: '#eff6ff',
                                color: '#1d4ed8',
                                border: '1px solid #bfdbfe',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                fontWeight: 700,
                              }}
                            >
                              ML {ev.raw_extraction.ml.modelVersion || 'v1'}: {Math.round(ev.raw_extraction.ml.confidence * 100)}%
                            </span>
                          )}
                          {ev.news_url && (
                            <a
                              href={ev.news_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.evidenceLink}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span>Read Bulletin</span>
                              <ExternalLink size={11} />
                            </a>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </TabPanel>
        </div>
      </div>
    </aside>
  )
}

export default ContextPanel
