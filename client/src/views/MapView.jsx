// Main MapView coordinating MapLibre WebGL canvas, search, geolocation, routing, and intelligence panel
import { useState, useCallback, useEffect } from 'react'
import { MapChrome } from '../map/MapChrome.jsx'
import { MapSurface } from '../map/MapSurface.jsx'
import { MapViewportProvider } from '../map/viewport.jsx'
import { ContextPanel } from '../panels/ContextPanel.jsx'
import { MobileBottomSheet } from '../panels/MobileBottomSheet.jsx'
import { ResqModeModal } from '../panels/ResqModeModal.jsx'
import { SourceAddressModal } from '../panels/SourceAddressModal.jsx'
import { ResqNavigationOverlay } from '../navigation/ResqNavigationOverlay.jsx'
import { useResqDrivingMode } from '../navigation/useResqDrivingMode.js'
import { MAP_MODES } from '../map/mapStyles.js'
import {
  getDeviceCoordinates,
  reverseGeocodeLocation,
  searchLocations,
  GEOLOCATION_STATE,
} from '../services/locationApi.js'
import { getCurrentGridRisk, getGridRisk } from '../services/riskApi.js'
import { ALL_CITIES } from '../services/citiesCatalog.js'
import { useRouteStore } from '../services/routeStore.js'
import styles from './MapView.module.css'

export default function MapView() {
  const [mode, setMode] = useState(MAP_MODES.NORMAL)
  const [mapInstance, setMapInstance] = useState(null)
  const [selectedLocation, setSelectedLocation] = useState(null)
  const [selectedGridId, setSelectedGridId] = useState(null)
  const [selectedGridGeometry, setSelectedGridGeometry] = useState(null)
  const [riskData, setRiskData] = useState(null)
  const [geoState, setGeoState] = useState(GEOLOCATION_STATE.INITIAL)
  const [geoError, setGeoError] = useState(null)
  const [isResqModeOpen, setIsResqModeOpen] = useState(false)

  // Route store state and dispatchers
  const {
    origin: routeOrigin,
    destination: routeDestination,
    routeData,
    navigationMode,
    isRouting,
    routingError,
    isSourceModalOpen,
    setDestination: setRouteDestination,
    openSourceModal,
    closeSourceModal,
    calculateRoutePlan,
    startDriving,
    clearRoute,
    hydrateNavigationSession,
  } = useRouteStore()

  // Driving mode controller hook attached to active MapLibre instance
  const { recenter } = useResqDrivingMode(mapInstance)

  // Hydrate saved navigation session on initial load
  useEffect(() => {
    hydrateNavigationSession()
  }, [hydrateNavigationSession])

  // Keep destination synced with currently selected location
  const handleSelectLocation = useCallback((loc) => {
    setSelectedLocation(loc)
    if (loc) {
      setRouteDestination(loc)
    }
  }, [setRouteDestination])

  // 1. Real-Time Browser Geolocation Handler with Reverse Geocode Resolution
  const handleLocateMe = useCallback(async () => {
    setGeoState(GEOLOCATION_STATE.LOCATING)
    setGeoError(null)

    try {
      const coords = await getDeviceCoordinates()
      setGeoState(GEOLOCATION_STATE.LOCATED)

      // Fetch reverse geocode and PostGIS risk in parallel
      const [reverseInfo, pointRisk] = await Promise.all([
        reverseGeocodeLocation(coords.lat, coords.lon).catch(() => null),
        getCurrentGridRisk(coords.lat, coords.lon).catch(() => null),
      ])

      const placeName = reverseInfo?.name || (pointRisk?.district ? `${pointRisk.district}` : 'Your Location')
      const districtName = reverseInfo?.district || pointRisk?.district || 'Kamrup Metropolitan'
      const stateName = reverseInfo?.state || pointRisk?.state || 'India'

      const userLoc = {
        name: placeName,
        district: districtName,
        state: stateName,
        lat: coords.lat,
        lon: coords.lon,
        latitude: coords.lat,
        longitude: coords.lon,
        accuracy: coords.accuracy,
        gridId: pointRisk?.gridId || null,
        isLiveGps: true,
      }

      handleSelectLocation(userLoc)

      if (pointRisk) {
        setSelectedGridId(pointRisk.gridId)
        setSelectedGridGeometry(pointRisk.geometry)
        setRiskData(pointRisk)
      }
    } catch (err) {
      setGeoState(err.state || GEOLOCATION_STATE.ERROR)
      setGeoError(err.message || 'Unable to retrieve location.')

      // Default initial operational center
      const fallbackLat = 26.1445
      const fallbackLon = 91.7898
      const fallbackLoc = {
        name: 'Guwahati Dispur Hub',
        district: 'Kamrup Metropolitan',
        state: 'Assam',
        country: 'India',
        lat: fallbackLat,
        lon: fallbackLon,
        latitude: fallbackLat,
        longitude: fallbackLon,
        accuracy: 50,
      }

      handleSelectLocation(fallbackLoc)

      try {
        const pointRisk = await getCurrentGridRisk(fallbackLat, fallbackLon)
        if (pointRisk) {
          setSelectedGridId(pointRisk.gridId)
          setSelectedGridGeometry(pointRisk.geometry)
          setRiskData(pointRisk)
        }
      } catch (e) {
        console.error('Initial risk lookup failed:', e)
      }
    }
  }, [handleSelectLocation])

  // 2. Dynamic Place Selection Handler (Supports Objects & Names for Global & Nearby Cities)
  const handleSelectQuickPlace = useCallback(async (place) => {
    try {
      let top = null

      if (place && typeof place === 'object' && place.lat != null && place.lon != null) {
        top = {
          name: place.fullName || place.name,
          district: place.district || place.name,
          state: place.state || place.country || 'Global Zone',
          country: place.country || '',
          lat: parseFloat(place.lat),
          lon: parseFloat(place.lon),
          latitude: parseFloat(place.lat),
          longitude: parseFloat(place.lon),
          gridId: place.gridId || null,
        }
      } else if (typeof place === 'string') {
        const cleanName = place.toLowerCase().trim()
        const found = ALL_CITIES.find(
          (c) =>
            c.id === cleanName ||
            c.name.toLowerCase() === cleanName ||
            c.name.toLowerCase().includes(cleanName) ||
            cleanName.includes(c.name.toLowerCase())
        )
        if (found) {
          top = {
            name: found.fullName || found.name,
            district: found.district || found.name,
            state: found.state || found.country || 'Global Zone',
            country: found.country || '',
            lat: found.lat,
            lon: found.lon,
            latitude: found.lat,
            longitude: found.lon,
            gridId: found.gridId || null,
          }
        } else {
          const candidates = await searchLocations(place)
          if (candidates && candidates.length > 0) {
            top = candidates[0]
          }
        }
      }

      if (top) {
        handleSelectLocation(top)
        const pointRisk = await getCurrentGridRisk(top.lat, top.lon)
        if (pointRisk) {
          setSelectedGridId(pointRisk.gridId)
          setSelectedGridGeometry(pointRisk.geometry)
          setRiskData(pointRisk)
        }
      }
    } catch (err) {
      console.error('Quick place selection error:', err)
    }
  }, [handleSelectLocation])

  // Auto-initialize initial active zone on mount if no active location
  useEffect(() => {
    handleSelectQuickPlace('Guwahati')
  }, [handleSelectQuickPlace])

  // 3. Map Grid Cell Click Handler
  const handleGridSelect = useCallback(async (props) => {
    if (!props || !props.grid_id) return
    const gridId = props.grid_id
    setSelectedGridId(gridId)
    const gridLoc = {
      name: `Grid ${gridId}`,
      district: props.district || 'Assam',
      state: props.state || 'Assam',
      lat: parseFloat(props.center_lat),
      lon: parseFloat(props.center_lon),
      latitude: parseFloat(props.center_lat),
      longitude: parseFloat(props.center_lon),
    }
    handleSelectLocation(gridLoc)

    try {
      const risk = await getGridRisk(gridId)
      setRiskData(risk)
    } catch (err) {
      console.error('Grid risk fetch error:', err)
    }
  }, [handleSelectLocation])

  // 4. Active Event Marker Click Handler
  const handleEventSelect = useCallback(async (props) => {
    if (!props) return
    const lat = parseFloat(props.latitude)
    const lon = parseFloat(props.longitude)

    const eventLoc = {
      name: props.location_text || props.event_type || 'Disaster Incident',
      district: props.state || 'Assam',
      state: props.state || 'Assam',
      lat,
      lon,
      latitude: lat,
      longitude: lon,
    }
    handleSelectLocation(eventLoc)

    try {
      const pointRisk = await getCurrentGridRisk(lat, lon)
      if (pointRisk && pointRisk.inCoverage) {
        setSelectedGridId(pointRisk.gridId)
        setSelectedGridGeometry(pointRisk.geometry)
        setRiskData(pointRisk)
      }
    } catch (err) {
      console.error('Event grid lookup error:', err)
    }
  }, [handleSelectLocation])

  // 5. Origin Selected in SourceAddressModal -> Execute Route Calculation
  const handleOriginSelected = useCallback(async (selectedOrigin) => {
    const targetDest = routeDestination || selectedLocation
    if (!targetDest) return
    await calculateRoutePlan({
      origin: selectedOrigin,
      destination: targetDest,
      mode: 'fastest',
      vehicle: 'car',
    })
  }, [routeDestination, selectedLocation, calculateRoutePlan])

  // 6. Global Search Event Listener
  useEffect(() => {
    const handlePlaceEvent = async (e) => {
      const candidate = e.detail
      if (!candidate) return
      handleSelectLocation(candidate)

      const pointRisk = await getCurrentGridRisk(candidate.lat, candidate.lon)
      if (pointRisk && pointRisk.inCoverage) {
        setSelectedGridId(pointRisk.gridId)
        setSelectedGridGeometry(pointRisk.geometry)
        setRiskData(pointRisk)
      }
    }

    window.addEventListener('resq:select-place', handlePlaceEvent)
    return () => window.removeEventListener('resq:select-place', handlePlaceEvent)
  }, [handleSelectLocation])

  // 7. Auto-detect user's live location on initial mount
  useEffect(() => {
    handleLocateMe()
  }, [handleLocateMe])

  const isDriving = navigationMode === 'driving'

  return (
    <MapViewportProvider>
      <div className={styles.screen}>
        <div className={styles.mapArea}>
          <MapSurface
            mode={mode}
            selectedLocation={selectedLocation}
            selectedGridGeometry={selectedGridGeometry}
            selectedGridStatus={riskData?.riskSummary?.riskStatus}
            routeData={routeData}
            navigationMode={navigationMode}
            onGridSelect={handleGridSelect}
            onEventSelect={handleEventSelect}
            onMapReady={setMapInstance}
          />

          {/* Fullscreen Driving Navigation Overlay */}
          {isDriving && (
            <ResqNavigationOverlay onRecenter={recenter} />
          )}

          {/* Route calculation error toast */}
          {routingError && !isDriving && (
            <div className={styles.geoBanner} style={{ borderColor: '#fca5a5', background: '#fef2f2', color: '#b91c1c' }}>
              <span>{routingError}</span>
              <button
                type="button"
                className={styles.geoBannerClose}
                onClick={clearRoute}
                aria-label="Dismiss error"
              >
                ✕
              </button>
            </div>
          )}

          {geoError && !routingError && !isDriving && (
            <div className={styles.geoBanner}>
              <span>{geoError}</span>
              <button
                type="button"
                className={styles.geoBannerClose}
                onClick={() => setGeoError(null)}
                aria-label="Dismiss error"
              >
                ✕
              </button>
            </div>
          )}

          {!isDriving && (
            <MapChrome
              activeMode={mode}
              onModeChange={setMode}
              onLocateMe={handleLocateMe}
              isLocating={geoState === GEOLOCATION_STATE.LOCATING}
            />
          )}

          {!isDriving && (
            <MobileBottomSheet
              riskData={riskData}
              selectedLocation={selectedLocation}
              onOpenResqMode={openSourceModal}
            />
          )}
        </div>

        {!isDriving && (
          <ContextPanel
            selectedGridId={selectedGridId}
            selectedLocation={selectedLocation}
            onLocateMe={handleLocateMe}
            onSelectQuickPlace={handleSelectQuickPlace}
            onOpenResqMode={() => setIsResqModeOpen(true)}
            onGetDirections={openSourceModal}
            routeData={routeData}
            routeOrigin={routeOrigin}
            routeDestination={routeDestination || selectedLocation}
            onStartNavigation={startDriving}
            onClearRoute={clearRoute}
          />
        )}

        {/* Origin Selection Modal */}
        <SourceAddressModal
          isOpen={isSourceModalOpen}
          onClose={closeSourceModal}
          destination={routeDestination || selectedLocation}
          onSelectOrigin={handleOriginSelected}
          isRouting={isRouting}
        />

        {/* RESQ Emergency Mode Modal */}
        <ResqModeModal
          isOpen={isResqModeOpen}
          onClose={() => setIsResqModeOpen(false)}
          destinationGrid={selectedGridId}
          destinationPlace={selectedLocation}
        />
      </div>
    </MapViewportProvider>
  )
}
