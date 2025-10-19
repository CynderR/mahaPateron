import React, { useState } from 'react';
import axios from 'axios';
import './PatreonConfig.css';

interface Campaign {
  id: string;
  name: string;
  url: string;
  patron_count?: number;
  pledge_sum?: number;
}

interface PatreonConfigProps {
  onConfigSuccess: (campaign: Campaign) => void;
}

const PatreonConfig: React.FC<PatreonConfigProps> = ({ onConfigSuccess }) => {
  const [accessToken, setAccessToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [campaign, setCampaign] = useState<Campaign | null>(null);

  const handleTestConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await axios.post('/patreon/test', {
        accessToken: accessToken.trim()
      });

      setSuccess('Patreon connection successful!');
      setCampaign(response.data.campaign);
      onConfigSuccess(response.data.campaign);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to connect to Patreon');
    } finally {
      setLoading(false);
    }
  };

  const handleClearConfig = () => {
    setAccessToken('');
    setCampaign(null);
    setError('');
    setSuccess('');
  };

  return (
    <div className="patreon-config">
      <div className="config-header">
        <h3>🔗 Patreon Integration</h3>
        <p>Connect your Patreon account to manage subscribers</p>
      </div>

      {error && (
        <div className="error-banner">
          {error}
          <button onClick={() => setError('')} className="close-btn">×</button>
        </div>
      )}

      {success && (
        <div className="success-banner">
          {success}
          <button onClick={() => setSuccess('')} className="close-btn">×</button>
        </div>
      )}

      {!campaign ? (
        <form onSubmit={handleTestConnection} className="config-form">
          <div className="form-group">
            <label htmlFor="accessToken">Patreon Creator Access Token</label>
            <input
              type="password"
              id="accessToken"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="Enter your Patreon Creator Access Token"
              required
            />
            <small className="help-text">
              Get your Creator Access Token from{' '}
              <a 
                href="https://www.patreon.com/portal/registration/register-clients" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                Patreon Developer Settings
              </a>
            </small>
          </div>

          <button
            type="submit"
            disabled={loading || !accessToken.trim()}
            className="btn-primary"
          >
            {loading ? 'Testing Connection...' : 'Test Connection'}
          </button>
        </form>
      ) : (
        <div className="campaign-info">
          <div className="campaign-header">
            <h4>✅ Connected Campaign</h4>
            <button onClick={handleClearConfig} className="btn-secondary">
              Reconfigure
            </button>
          </div>
          
          <div className="campaign-details">
            <div className="campaign-item">
              <label>Campaign Name:</label>
              <span>{campaign.name}</span>
            </div>
            <div className="campaign-item">
              <label>Campaign URL:</label>
              <a href={campaign.url} target="_blank" rel="noopener noreferrer">
                {campaign.url}
              </a>
            </div>
            <div className="campaign-item">
              <label>Total Patrons:</label>
              <span>{campaign.patron_count ? campaign.patron_count.toLocaleString() : 'N/A'}</span>
            </div>
            <div className="campaign-item">
              <label>Monthly Pledge Sum:</label>
              <span>{campaign.pledge_sum ? `$${(campaign.pledge_sum / 100).toFixed(2)}` : 'N/A'}</span>
            </div>
          </div>
        </div>
      )}

      <div className="config-help">
        <h4>📋 How to get your Creator Access Token:</h4>
        <ol>
          <li>Go to <a href="https://www.patreon.com/portal/registration/register-clients" target="_blank" rel="noopener noreferrer">Patreon Developer Settings</a></li>
          <li>Create a new client or select an existing one</li>
          <li>Copy your Creator Access Token</li>
          <li>Paste it in the field above and click "Test Connection"</li>
        </ol>
        <p className="security-note">
          🔒 Your access token is stored securely and only used to fetch your campaign data.
        </p>
      </div>
    </div>
  );
};

export default PatreonConfig;
