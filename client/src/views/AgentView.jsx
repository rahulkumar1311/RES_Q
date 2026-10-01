// RESQ Disaster Response Agent View
// Provides a dedicated operational interface for autonomous multi-step route and disaster analysis

import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Send,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  Layers,
  Cpu,
} from 'lucide-react'
import { Badge, Button, Divider, Spinner } from '../ui/index.js'
import { runAgentQuery } from '../services/api.js'
import { useRouteStore } from '../services/routeStore.js'
import styles from './AgentView.module.css'

const SUGGESTED_QUERIES = [
  'Find a safe route from Guwahati to Shillong during flood conditions',
  'Check route between Boko and Dispur under landslide conditions',
  'Assess bridge damage risk from Nongpoh to Guwahati',
]

export default function AgentView() {
  const navigate = useNavigate()
  const { setOrigin, setDestination } = useRouteStore()

  const [query, setQuery] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState(null)
  const [agentResult, setAgentResult] = useState(null)

  const handleSubmit = useCallback(
    async (e) => {
      if (e) e.preventDefault()
      const trimmed = query.trim()
      if (!trimmed || isRunning) return

      setIsRunning(true)
      setError(null)

      try {
        const result = await runAgentQuery(trimmed)
        setAgentResult(result)
        if (!result.success) {
          setError(result.error?.message || result.summary || 'Agent could not find a verified corridor. Please refine origin or destination.')
        }
      } catch (err) {
        setError(err.message || 'Agent execution failed. Please check network connectivity and try again.')
      } finally {
        setIsRunning(false)
      }
    },
    [query, isRunning]
  )

  const handleSelectSuggestion = (suggestion) => {
    if (isRunning) return
    setQuery(suggestion)
  }

  // Safe handler to load agent-selected route onto existing RESQ map
  const handleViewOnMap = () => {
    if (!agentResult?.recommendedRoute) return

    const orig = agentResult.recommendedRoute.origin || { name: agentResult.origin }
    const dest = agentResult.recommendedRoute.destination || { name: agentResult.destination }

    if (orig) setOrigin(orig)
    if (dest) setDestination(dest)

    navigate('/')
  }

  // Render safety status badge
  const renderSafetyBadge = (status, isBlocked) => {
    if (isBlocked || status === 'UNSAFE' || status === 'BLOCKED' || status === 'CRITICAL') {
      return (
        <Badge tone="critical" size="lg">
          <ShieldAlert size={14} style={{ marginRight: 6 }} />
          UNSAFE
        </Badge>
      )
    }
    if (status === 'SAFE') {
      return (
        <Badge tone="low" size="lg">
          <ShieldCheck size={14} style={{ marginRight: 6 }} />
          SAFE
        </Badge>
      )
    }
    return (
      <Badge tone="high" size="lg">
        <AlertTriangle size={14} style={{ marginRight: 6 }} />
        UNKNOWN
      </Badge>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.badgeRow}>
            <Badge tone="accent">Bharat Agentic 2026</Badge>
            <Badge tone="quiet">Autonomous Pipeline</Badge>
          </div>
          <h1 className={styles.title}>RESQ Disaster Response Agent</h1>
          <p className={styles.subtitle}>
            AI-powered multi-step disaster response and route analysis. The agent plans, executes registered
            spatial tools, inspects 500m PostGIS risk grids, and replans safe corridors around active hazards.
          </p>
        </header>

        {/* User Input Section */}
        <section className={styles.inputCard}>
          <form onSubmit={handleSubmit} className={styles.inputGroup}>
            <label htmlFor="agent-query-input" className={styles.inputLabel}>
              Emergency Transit Objective
            </label>
            <textarea
              id="agent-query-input"
              className={styles.textarea}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Example: Find a safe route from Guwahati to Shillong during flood conditions."
              disabled={isRunning}
              rows={2}
            />

            {/* Scenario Suggestion Chips */}
            <div className={styles.suggestionChips}>
              <span className={styles.suggestionLabel}>Examples:</span>
              {SUGGESTED_QUERIES.map((sq, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={styles.chipBtn}
                  onClick={() => handleSelectSuggestion(sq)}
                  disabled={isRunning}
                >
                  {sq}
                </button>
              ))}
            </div>

            <div className={styles.actionRow}>
              <div className={styles.agentNotice}>
                <span className={styles.pulseDot} />
                <span>6 registered spatial tools active on PostGIS & Valhalla router</span>
              </div>

              <Button
                type="submit"
                variant="primary"
                disabled={!query.trim() || isRunning}
                iconRight={isRunning ? Spinner : Send}
              >
                {isRunning ? 'Analyzing...' : 'Analyze Request'}
              </Button>
            </div>
          </form>
        </section>

        {/* Loading State */}
        {isRunning && (
          <div className={styles.loadingCard}>
            <Spinner size="md" />
            <div className={styles.loadingTextCol}>
              <span className={styles.loadingTitle}>Agent is executing multi-step reasoning plan...</span>
              <span className={styles.loadingSub}>
                Gathering hazard bulletins, calculating road trajectories, and checking 500m grid risk cells
              </span>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className={styles.errorCard} role="alert">
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <div>
              <strong>Agent Notice: </strong>
              {error}
            </div>
          </div>
        )}

        {/* Operational Execution Trace */}
        {agentResult && Array.isArray(agentResult.executionTrace) && agentResult.executionTrace.length > 0 && (
          <section>
            <div className={styles.sectionTitleRow}>
              <h2 className={styles.sectionTitle}>
                <Cpu size={18} />
                Agent Activity — Agent Execution Trace
              </h2>
              <Badge tone="quiet">{agentResult.executionTrace.length} Steps Completed</Badge>
            </div>

            <div className={styles.traceList}>
              {agentResult.executionTrace.map((trace, idx) => {
                const isWarn = trace.status === 'warning'
                const isFail = trace.status === 'failed'
                const Icon = isWarn ? AlertTriangle : isFail ? AlertCircle : CheckCircle2

                return (
                  <div
                    key={idx}
                    className={`${styles.traceItem} ${isWarn ? styles.traceWarning : isFail ? styles.traceFailed : ''}`}
                  >
                    <Icon size={16} className={styles.traceIcon} color={isWarn ? '#f59e0b' : isFail ? '#ef4444' : '#10b981'} />
                    <div className={styles.traceTextCol}>
                      <span className={styles.traceMessage}>{trace.message}</span>
                      <span className={styles.traceStep}>{trace.step}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Tool Activity Section */}
        {agentResult && Array.isArray(agentResult.toolCalls) && agentResult.toolCalls.length > 0 && (
          <section>
            <div className={styles.sectionTitleRow}>
              <h2 className={styles.sectionTitle}>
                <Layers size={18} />
                Tool Activity — Tool Execution Activity
              </h2>
              <Badge tone="quiet">{agentResult.toolCalls.length} Tool Executions</Badge>
            </div>

            <div className={styles.toolsGrid}>
              {agentResult.toolCalls.map((tc, idx) => (
                <div key={idx} className={styles.toolCard}>
                  <div className={styles.toolCardHeader}>
                    <span className={styles.toolName}>{tc.tool}</span>
                    <Badge tone={tc.status === 'completed' ? 'low' : 'critical'} size="sm">
                      {tc.status}
                    </Badge>
                  </div>
                  <p className={styles.toolSummary}>{tc.summary || 'Completed successfully'}</p>
                  <span className={styles.toolDuration}>
                    <Clock size={11} style={{ display: 'inline', marginRight: 4 }} />
                    {tc.durationMs} ms
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Final Recommendation Result */}
        {agentResult && agentResult.recommendedRoute && (
          <section className={styles.resultCard}>
            <div className={styles.resultHeader}>
              <div className={styles.resultTitleCol}>
                <h2 className={styles.resultTitle}>Final Result — Recommended Route Plan</h2>
                <span className={styles.resultRouteInfo}>
                  Transit: <strong>{agentResult.origin || 'Origin'}</strong> → <strong>{agentResult.destination || 'Destination'}</strong>
                </span>
              </div>
              {renderSafetyBadge(agentResult.recommendedRoute.riskStatus, agentResult.recommendedRoute.isBlocked)}
            </div>

            <Divider />

            {/* Metrics Grid */}
            <div className={styles.metricsGrid}>
              <div className={styles.metricBox}>
                <span className={styles.metricLabel}>Safety Status</span>
                <span className={styles.metricValue}>
                  {agentResult.recommendedRoute.riskStatus || (agentResult.recommendedRoute.isBlocked ? 'BLOCKED' : 'SAFE')}
                </span>
              </div>

              <div className={styles.metricBox}>
                <span className={styles.metricLabel}>Distance</span>
                <span className={styles.metricValue}>
                  {agentResult.recommendedRoute.distanceKm !== undefined ? `${agentResult.recommendedRoute.distanceKm} km` : 'Not available'}
                </span>
              </div>

              <div className={styles.metricBox}>
                <span className={styles.metricLabel}>Estimated Time</span>
                <span className={styles.metricValue}>
                  {agentResult.recommendedRoute.durationMinutes !== undefined ? `${agentResult.recommendedRoute.durationMinutes} min` : 'Not available'}
                </span>
              </div>

              <div className={styles.metricBox}>
                <span className={styles.metricLabel}>Risk</span>
                <span className={styles.metricValue}>
                  {agentResult.recommendedRoute.meanRiskScore !== undefined ? `${agentResult.recommendedRoute.meanRiskScore}/100` : 'Not available'}
                </span>
              </div>

              <div className={styles.metricBox}>
                <span className={styles.metricLabel}>Blockage</span>
                <span className={styles.metricValue}>
                  {agentResult.recommendedRoute.isBlocked ? 'BLOCKED' : 'CLEAR'}
                </span>
              </div>
            </div>

            {/* Recommendation Summary Statement */}
            {agentResult.summary && (
              <div className={styles.summaryBox}>
                <strong>Recommendation: </strong>
                {agentResult.summary}
              </div>
            )}

            {/* Warnings Statement */}
            {Array.isArray(agentResult.warnings) && agentResult.warnings.length > 0 && (
              <div className={styles.warningsList}>
                <span className={styles.inputLabel}>Warnings & Advisories</span>
                {agentResult.warnings.map((warn, idx) => (
                  <div key={idx} className={styles.warningItem}>
                    <AlertTriangle size={14} color="#d97706" style={{ flexShrink: 0 }} />
                    <span>{warn}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Safety Assessment Statement */}
            {agentResult.recommendedRoute.riskStatus === 'UNKNOWN' && (
              <div className={styles.summaryBox} style={{ borderLeftColor: '#f59e0b' }}>
                <strong>Safety Assessment: </strong>
                Safety could not be verified with the available data.
              </div>
            )}

            {/* Detected Hazards List */}
            {Array.isArray(agentResult.hazards) && agentResult.hazards.length > 0 && (
              <div className={styles.hazardsList}>
                <span className={styles.inputLabel}>Hazards & Regional Bulletins</span>
                {agentResult.hazards.slice(0, 3).map((h, idx) => (
                  <div key={idx} className={styles.hazardItem}>
                    <div className={styles.hazardText}>
                      <AlertTriangle size={14} color="#ef4444" />
                      <span>{h.title || h.eventType}</span>
                    </div>
                    <Badge tone={h.roadBlocked ? 'critical' : 'high'} size="sm">
                      {h.hazardType || 'HAZARD'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            <div className={styles.resultActions}>
              <Button
                type="button"
                variant="primary"
                onClick={handleViewOnMap}
                iconRight={ArrowRight}
              >
                View on Map
              </Button>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
