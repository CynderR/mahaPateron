import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import PodcastNav from '../../components/PodcastNav';

interface Stats {
  totalUsers: number;
  payingUsers: number;
  freeUsers: number;
  mrr: number;
  totalPosts: number;
  libraryEntries: number;
  totalStreams: number;
  totalStreamHours: number;
}

const StatCard: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div className="pod-stat-card">
    <p className="pod-stat-label">{label}</p>
    <p className="pod-stat-value">{value}</p>
  </div>
);

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    axios
      .get<Stats>('/admin/stats')
      .then((res) => setStats(res.data))
      .catch(() => setError('Could not load dashboard stats.'));
  }, []);

  return (
    <div className="podcast-page">
      <PodcastNav />
      <main className="podcast-main">
        <h2 className="podcast-section-title">Admin Dashboard</h2>
        {error && <div className="pod-banner pod-banner-error">{error}</div>}

        {stats && (
          <div className="pod-stats-grid">
            <StatCard label="Total users" value={stats.totalUsers} />
            <StatCard label="Paying users" value={stats.payingUsers} />
            <StatCard label="Free users" value={stats.freeUsers} />
            <StatCard label="MRR" value={`$${stats.mrr.toFixed(2)}`} />
            <StatCard label="Total posts" value={stats.totalPosts} />
            <StatCard label="Library episodes" value={stats.libraryEntries} />
            <StatCard label="Stream hours" value={stats.totalStreamHours} />
          </div>
        )}

        <div className="pod-card">
          <h3 style={{ marginTop: 0 }}>Quick Links</h3>
          <div className="pod-inline-actions">
            <Link className="pod-btn" to="/admin/users">
              Manage Users
            </Link>
            <Link className="pod-btn" to="/admin/posts">
              Manage Posts
            </Link>
            <Link className="pod-btn" to="/admin/library">
              Manage Library
            </Link>
            <Link className="pod-btn" to="/admin/bulk-upload">
              Bulk Upload
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
