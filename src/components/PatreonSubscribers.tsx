import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './PatreonSubscribers.css';

interface Patron {
  id: string;
  patron_status?: string;
  pledge_relationship_start?: string;
  pledge_amount_cents?: number;
  pledge_created_at?: string;
  pledge_declined_since?: string;
  will_pay_amount_cents?: number;
  user: {
    id: string;
    email?: string;
    first_name: string;
    last_name: string;
    full_name: string;
    vanity?: string;
    image_url?: string;
    created?: string;
    url: string;
  } | null;
  tier: Array<{
    id: string;
    title: string;
    description: string;
    amount_cents: number;
    created_at?: string;
    url?: string;
  }> | null;
}

type SortColumn = 'name' | 'email' | 'status' | 'pledge' | 'tier' | 'memberSince' | null;
type SortDirection = 'asc' | 'desc';

const PatreonSubscribers: React.FC = () => {
  const [patrons, setPatrons] = useState<Patron[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);
  const [total, setTotal] = useState(0);
  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const fetchPatrons = async () => {
    setLoading(true);
    setError('');

    try {
      const endpoint = activeOnly ? '/patreon/patrons/active' : '/patreon/patrons';
      const response = await axios.get(endpoint);
      
      setPatrons(response.data.patrons);
      setTotal(response.data.total);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch patrons');
    } finally {
      setLoading(false);
    }
  };

  const syncPatrons = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await axios.post('/patreon/sync');
      
      const { synced, errors, subscriptionAlerts } = response.data;
      
      let message = `Sync completed! ${synced} users synced, ${errors} errors.`;
      if (subscriptionAlerts > 0) {
        message += `\n\n🚨 ${subscriptionAlerts} subscription alerts generated for premium users who unsubscribed.`;
      }
      
      alert(message);
      
      // Refresh the patrons list
      await fetchPatrons();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to sync patrons');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatrons();
  }, [activeOnly]);

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusBadge = (status: string) => {
    const statusMap: { [key: string]: { class: string; text: string } } = {
      'active_patron': { class: 'active', text: 'Active' },
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

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Toggle direction if clicking the same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new column and default to ascending
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const getSortedPatrons = () => {
    if (!sortColumn) return patrons;

    const sorted = [...patrons].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortColumn) {
        case 'name':
          aValue = a.user?.full_name || 'Unknown';
          bValue = b.user?.full_name || 'Unknown';
          break;
        case 'email':
          aValue = a.user?.email || 'N/A';
          bValue = b.user?.email || 'N/A';
          break;
        case 'status':
          aValue = a.patron_status || 'unknown';
          bValue = b.patron_status || 'unknown';
          break;
        case 'pledge':
          aValue = a.will_pay_amount_cents || (a.tier && a.tier.length > 0 ? a.tier[0].amount_cents : 0);
          bValue = b.will_pay_amount_cents || (b.tier && b.tier.length > 0 ? b.tier[0].amount_cents : 0);
          break;
        case 'tier':
          aValue = a.tier && a.tier.length > 0 ? a.tier[0].title : 'No Tier';
          bValue = b.tier && b.tier.length > 0 ? b.tier[0].title : 'No Tier';
          break;
        case 'memberSince':
          aValue = a.pledge_relationship_start || a.pledge_created_at || '';
          bValue = b.pledge_relationship_start || b.pledge_created_at || '';
          break;
        default:
          return 0;
      }

      // Handle null/undefined values
      if (aValue === null || aValue === undefined) aValue = '';
      if (bValue === null || bValue === undefined) bValue = '';

      // Compare values
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      } else {
        // Numeric comparison
        return sortDirection === 'asc' 
          ? (aValue as number) - (bValue as number)
          : (bValue as number) - (aValue as number);
      }
    });

    return sorted;
  };

  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) {
      return <span className="sort-icon">↕</span>;
    }
    return sortDirection === 'asc' 
      ? <span className="sort-icon">↑</span>
      : <span className="sort-icon">↓</span>;
  };

  return (
    <div className="patreon-subscribers">
      <div className="subscribers-header">
        <h3>👥 Patreon Subscribers</h3>
        <div className="header-controls">
          <div className="filter-controls">
            <label className="filter-label">
              <input
                type="radio"
                name="filter"
                checked={activeOnly}
                onChange={() => setActiveOnly(true)}
              />
              Active Only
            </label>
            <label className="filter-label">
              <input
                type="radio"
                name="filter"
                checked={!activeOnly}
                onChange={() => setActiveOnly(false)}
              />
              All Patrons
            </label>
          </div>
          <button
            onClick={syncPatrons}
            disabled={loading}
            className="btn-sync"
          >
            {loading ? 'Syncing...' : '🔄 Sync with Users'}
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          {error}
          <button onClick={() => setError('')} className="close-btn">×</button>
        </div>
      )}

      <div className="subscribers-stats">
        <div className="stat-item">
          <span className="stat-label">Total {activeOnly ? 'Active' : ''} Patrons:</span>
          <span className="stat-value">{total}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Monthly Revenue:</span>
          <span className="stat-value">
            {formatCurrency(patrons.reduce((sum, patron) => {
              // Use will_pay_amount_cents if available, otherwise sum tier amounts
              if (patron.will_pay_amount_cents) {
                return sum + patron.will_pay_amount_cents;
              } else if (patron.tier && patron.tier.length > 0) {
                return sum + patron.tier.reduce((tierSum, tier) => tierSum + tier.amount_cents, 0);
              }
              return sum;
            }, 0))}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading patrons...</div>
      ) : (
        <div className="patrons-table-container">
          <table className="patrons-table">
            <thead>
              <tr>
                <th 
                  className="sortable" 
                  onClick={() => handleSort('name')}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  Name {getSortIcon('name')}
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
                  onClick={() => handleSort('status')}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  Status {getSortIcon('status')}
                </th>
                <th 
                  className="sortable" 
                  onClick={() => handleSort('pledge')}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  Pledge Amount {getSortIcon('pledge')}
                </th>
                <th 
                  className="sortable" 
                  onClick={() => handleSort('tier')}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  Tier {getSortIcon('tier')}
                </th>
                <th 
                  className="sortable" 
                  onClick={() => handleSort('memberSince')}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  Member Since {getSortIcon('memberSince')}
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {getSortedPatrons().map((patron) => (
                <tr key={patron.id}>
                  <td>
                    <div className="patron-name">
                      {patron.user?.image_url && (
                        <img 
                          src={patron.user.image_url} 
                          alt={patron.user.full_name}
                          className="patron-avatar"
                        />
                      )}
                      <span>{patron.user?.full_name || 'Unknown'}</span>
                    </div>
                  </td>
                  <td>{patron.user?.email || 'N/A'}</td>
                  <td>{getStatusBadge(patron.patron_status || 'active_patron')}</td>
                  <td>
                    {patron.will_pay_amount_cents 
                      ? formatCurrency(patron.will_pay_amount_cents)
                      : patron.tier && patron.tier.length > 0
                        ? formatCurrency(patron.tier[0].amount_cents)
                        : 'N/A'
                    }
                  </td>
                  <td>
                    {patron.tier && patron.tier.length > 0 ? (
                      <div className="tier-info">
                        {patron.tier.map((t, index) => (
                          <span key={t.id} className="tier-badge">
                            {t.title}
                          </span>
                        ))}
                      </div>
                    ) : (
                      'No Tier'
                    )}
                  </td>
                  <td>
                    {patron.pledge_relationship_start 
                      ? formatDate(patron.pledge_relationship_start)
                      : patron.pledge_created_at
                        ? formatDate(patron.pledge_created_at)
                        : 'N/A'
                    }
                  </td>
                  <td>
                    <div className="action-buttons">
                      {patron.user?.url && (
                        <a
                          href={patron.user.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-view"
                        >
                          View Profile
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {patrons.length === 0 && !loading && (
        <div className="no-patrons">
          <p>No {activeOnly ? 'active ' : ''}patrons found.</p>
        </div>
      )}
    </div>
  );
};

export default PatreonSubscribers;
