import { useEffect, useState, useCallback } from 'react';
import './index.css';

interface LocationDebug {
  locationId: string;
  accountId: string;
  title: string | null;
}

interface LocationResponse {
  locationId: string;
  accountId: string;
  title: string | null;
}

interface Review {
  reviewerName: string;
  starRating: string;
  comment: string;
  reviewCreateTime: string | Date;
}

interface Summary {
  average: number;
  total: number;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://reviewfetcher-backend.onrender.com';

function App() {
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [locations, setLocations] = useState<LocationDebug[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');

  // New state for reviews
  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [activeLocationId, setActiveLocationId] = useState('');

  const syncLocations = useCallback(async () => {
    setSyncing(true);
    setSyncError('');
    try {
      const res = await fetch(`${API_BASE_URL}/reviews/locations?clinicId=1`, {
        method: 'POST',
      });
      const data = await res.json();
      console.log('🔍 Sync Locations Response:', data);

      if (data?.locations?.length) {
        setLocations(
          data.locations.map((loc: LocationResponse) => ({
            locationId: loc.locationId,
            accountId: loc.accountId,
            title: loc.title ?? null,
          }))
        );
      } else {
        setSyncError('No locations returned from Google. Check backend logs.');
      }
    } catch (err: unknown) {
      console.error('syncLocations fetch error:', err);
      setSyncError('Could not reach backend: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const error = urlParams.get('error');

    if (success === 'true') {
      setStatus('success');
      // Auto-sync locations right after consent to get accountId + locationId
      syncLocations();
    } else if (success === 'false') {
      setStatus('error');
      setErrorMsg(error || 'Failed to authenticate');
    }

    // Clean up URL
    if (success) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [syncLocations]);

  const handleViewReviews = async (locationId: string) => {
    setLoadingReviews(true);
    setActiveLocationId(locationId);
    try {
      // 1. Sync reviews from Google (Update DB)
      await fetch(`${API_BASE_URL}/reviews/locations/${locationId}/sync?clinicId=1`, {
        method: 'POST',
      });

      // 2. Get reviews from DB
      const res = await fetch(`${API_BASE_URL}/reviews/locations/${locationId}`);
      const data = await res.json();

      setReviews(data.reviews || []);
      setSummary(data.summary || null);
    } catch (err: unknown) {
      console.error('handleViewReviews error:', err);
      alert('Failed to fetch reviews: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoadingReviews(false);
    }
  };

  const handleConnect = () => {
    window.location.href = `${API_BASE_URL}/auth/google?clinicId=1`;
  };

  return (
    <div className="dashboard">
      <h1>MyBusiness Portal</h1>
      <p>Connect your Google Business account to seamlessly fetch reviews.</p>

      {status === 'success' && (
        <div className="alert success">
          Google Business Connected Successfully! 🎉
        </div>
      )}

      {status === 'error' && (
        <div className="alert error">
          Oops! Connection failed: {errorMsg}
        </div>
      )}

      {/* ── DEBUG PANEL ── */}
      {status === 'success' && (
        <div style={{
          marginTop: '24px',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: '12px',
          padding: '20px',
          textAlign: 'left',
          fontFamily: 'monospace',
          fontSize: '14px',
        }}>
          <div style={{ color: '#a0e9a0', fontWeight: 'bold', marginBottom: '12px' }}>
            🛠 Debug Info — Locations Sync
          </div>

          {syncing && (
            <div style={{ color: '#facc15' }}>⏳ Syncing locations from Google…</div>
          )}

          {syncError && (
            <div style={{ color: '#f87171' }}>❌ {syncError}</div>
          )}

          {!syncing && locations.length === 0 && !syncError && (
            <div style={{ color: '#94a3b8' }}>No locations loaded yet.</div>
          )}

          {locations.map((loc, i) => (
            <div key={i} style={{
              marginBottom: '12px',
              padding: '12px',
              background: 'rgba(0,0,0,0.3)',
              borderRadius: '8px',
              borderLeft: '3px solid #4ade80',
            }}>
              <div>📍 <strong>Location #{i + 1}</strong> {loc.title ? `— ${loc.title}` : ''}</div>
              <div style={{ marginTop: '6px', color: '#7dd3fc' }}>
                accountId: <span style={{ color: '#f0abfc' }}>{loc.accountId}</span>
              </div>
              <div style={{ color: '#7dd3fc' }}>
                locationId: <span style={{ color: '#f0abfc' }}>{loc.locationId}</span>
              </div>

              <button
                className="btn-small"
                style={{ marginTop: '12px', width: '100%' }}
                onClick={() => handleViewReviews(loc.locationId)}
                disabled={loadingReviews}
              >
                {loadingReviews && activeLocationId === loc.locationId ? '⌛ Syncing...' : '⭐ View Reviews'}
              </button>
            </div>
          ))}

        </div>
      )}

      {/* ── REVIEWS SECTION ── */}
      {reviews.length > 0 && (
        <div style={{ marginTop: '32px', textAlign: 'left' }}>
          <h2 style={{ fontSize: '20px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Reviews</span>
            {summary && (
              <span style={{ fontSize: '14px', background: '#4ade8022', color: '#4ade80', padding: '2px 8px', borderRadius: '12px' }}>
                ⭐ {summary.average} ({summary.total} total)
              </span>
            )}
          </h2>

          <div style={{ display: 'grid', gap: '16px' }}>
            {reviews.map((rev, i) => (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                padding: '16px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <strong style={{ color: '#e2e8f0' }}>{rev.reviewerName}</strong>
                  <span style={{ color: '#fbbf24' }}>{'★'.repeat(parseInt(rev.starRating?.replace('STAR_', '')) || 0)}</span>
                </div>
                <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: '1.5', margin: 0 }}>
                  {rev.comment || 'No comment provided.'}
                </p>
                <div style={{ marginTop: '8px', fontSize: '12px', color: '#475569' }}>
                  {rev.reviewCreateTime ? new Date(rev.reviewCreateTime).toLocaleDateString() : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: '32px' }}>
        <button className="btn" onClick={handleConnect}>
          <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            <path d="M1 1h22v22H1z" fill="none" />
          </svg>
          Connect Google Business
        </button>
      </div>
    </div>
  );
}

export default App;
