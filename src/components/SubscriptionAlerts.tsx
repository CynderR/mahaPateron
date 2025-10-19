import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './SubscriptionAlerts.css';

interface SubscriptionAlert {
  id: number;
  username: string;
  email: string;
  patreon_id?: string;
  subscription_status: string;
  last_sync?: string;
  alert_sent: boolean;
}

const SubscriptionAlerts: React.FC = () => {
  const [alerts, setAlerts] = useState<SubscriptionAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchAlerts = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await axios.get('/patreon/alerts');
      setAlerts(response.data.alerts);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch subscription alerts');
    } finally {
      setLoading(false);
    }
  };

  const clearAlert = async (userId: number) => {
    try {
      await axios.post(`/patreon/alerts/${userId}/clear`);
      await fetchAlerts(); // Refresh the alerts list
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to clear alert');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: { [key: string]: { class: string; text: string } } = {
      'declined_patron': { class: 'declined', text: 'Declined' },
      'former_patron': { class: 'former', text: 'Former' },
      'null': { class: 'unknown', text: 'Unknown' }
    };

    const statusInfo = statusMap[status] || { class: 'unknown', text: status };
    
    return (
      <span className={`status-badge ${statusInfo.class}`}>
        {statusInfo.text}
      </span>
    );
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString();
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  if (loading) {
    return (
      <div className="subscription-alerts">
        <div className="loading">Loading subscription alerts...</div>
      </div>
    );
  }

  return (
    <div className="subscription-alerts">
      <div className="alerts-header">
        <h3>🚨 Subscription Alerts</h3>
        <div className="header-actions">
          <button onClick={fetchAlerts} className="btn-refresh">
            🔄 Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          {error}
          <button onClick={() => setError('')} className="close-btn">×</button>
        </div>
      )}

      <div className="alerts-info">
        <p>
          These are premium users who have unsubscribed from Patreon. 
          Free users who unsubscribe are not tracked.
        </p>
      </div>

      {alerts.length === 0 ? (
        <div className="no-alerts">
          <p>✅ No subscription alerts at this time.</p>
          <p>All premium users are currently subscribed to Patreon.</p>
        </div>
      ) : (
        <>
          <div className="alerts-summary">
            <div className="summary-item">
              <span className="summary-label">Total Alerts:</span>
              <span className="summary-value">{alerts.length}</span>
            </div>
          </div>

          <div className="alerts-table-container">
            <table className="alerts-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Patreon ID</th>
                  <th>Status</th>
                  <th>Last Sync</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert) => (
                  <tr key={alert.id}>
                    <td>
                      <div className="user-info">
                        <span className="username">{alert.username}</span>
                      </div>
                    </td>
                    <td>{alert.email}</td>
                    <td>{alert.patreon_id || 'N/A'}</td>
                    <td>{getStatusBadge(alert.subscription_status)}</td>
                    <td>{formatDate(alert.last_sync)}</td>
                    <td>
                      <div className="action-buttons">
                        <button
                          onClick={() => clearAlert(alert.id)}
                          className="btn-clear"
                        >
                          Clear Alert
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default SubscriptionAlerts;
