// Persistent chrome around views with mandatory in-dashboard modal authentication overlay

import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { TopBar } from './TopBar.jsx'
import { useAuth } from './authContext.jsx'
import { useRouteStore } from '../services/routeStore.js'
import LoginView from '../views/LoginView.jsx'
import styles from './AppShell.module.css'

export function AppShell({ children }) {
  const location = useLocation()
  const { isAuthenticated, isLoading } = useAuth()
  const { navigationMode } = useRouteStore()
  const [isLoginDismissed, setIsLoginDismissed] = useState(false)
  const isMap = location.pathname === '/'
  const isDriving = navigationMode === 'driving'
  const isAgent = location.pathname === '/agent'
  const isAbout = location.pathname === '/about'
  const isPublicPage = isAgent || isAbout

  return (
    <div className={styles.shell}>
      {!isDriving && <TopBar showSearch={isMap} />}
      <main className={styles.main}>{children}</main>

      {/* Mandatory Authentication Overlay over Live Map Dashboard — excluded on public routes (/agent, /about) */}
      {!isLoading && !isAuthenticated && !isPublicPage && !isLoginDismissed && (
        <LoginView onClose={() => setIsLoginDismissed(true)} />
      )}
    </div>
  )
}

export default AppShell
