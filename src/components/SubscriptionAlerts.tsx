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

type AlertSortColumn = 'user' | 'email' | 'patreon' | 'status' | 'lastSync' | null;
type AlertSortDirection = 'asc' | 'desc';

const SubscriptionAlerts: React.FC = () => {
  const [alerts, setAlerts] = useState<SubscriptionAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sortColumn, setSortColumn] = useState<AlertSortColumn>(null);
  const [sortDirection, setSortDirection] = useState<AlertSortDirection>('asc');

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

  const handleSort = (column: AlertSortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const getSortedAlerts = () => {
    if (!sortColumn) return alerts;

    const sorted = [...alerts].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortColumn) {
        case 'user':
          aValue = a.username || '';
          bValue = b.username || '';
          break;
        case 'email':
          aValue = a.email || '';
          bValue = b.email || '';
          break;
        case 'patreon':
          aValue = a.patreon_id || 'N/A';
          bValue = b.patreon_id || 'N/A';
          break;
        case 'status':
          aValue = a.subscription_status || '';
          bValue = b.subscription_status || '';
          break;
        case 'lastSync':
          aValue = a.last_sync ? new Date(a.last_sync).getTime() : 0;
          bValue = b.last_sync ? new Date(b.last_sync).getTime() : 0;
          break;
        default:
          return 0;
      }

      if (aValue === null || aValue === undefined) aValue = '';
      if (bValue === null || bValue === undefined) bValue = '';

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      } else {
        return sortDirection === 'asc' 
          ? (aValue as number) - (bValue as number)
          : (bValue as number) - (aValue as number);
      }
    });

    return sorted;
  };

  const getSortIcon = (column: AlertSortColumn) => {
    if (sortColumn !== column) {
      return <span className="sort-icon">↕</span>;
    }
    return sortDirection === 'asc' 
      ? <span className="sort-icon">↑</span>
      : <span className="sort-icon">↓</span>;
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
                  <th 
                    className="sortable" 
                    onClick={() => handleSort('user')}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                  >
                    User {getSortIcon('user')}
                  </th>
                  <th 
                    className="sortable" 
                    onClick={() => handleSort('email')}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                  >
                    Email {getSortIcon('email')}
                  </th>
                  <th 
                    className="sortable" 
                    onClick={() => handleSort('patreon')}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                  >
                    Patreon ID {getSortIcon('patreon')}
                  </th>
                  <th 
                    className="sortable" 
                    onClick={() => handleSort('status')}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                  >
                    Status {getSortIcon('status')}
                  </th>
                  <th 
                    className="sortable" 
                    onClick={() => handleSort('lastSync')}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                  >
                    Last Sync {getSortIcon('lastSync')}
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {getSortedAlerts().map((alert) => (
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
