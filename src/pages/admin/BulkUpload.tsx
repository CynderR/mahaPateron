import React from 'react';
import { Link } from 'react-router-dom';
import PodcastNav from '../../components/PodcastNav';
import BulkUploadForm from '../../components/BulkUploadForm';

const BulkUpload: React.FC = () => {
  return (
    <div className="podcast-page">
      <PodcastNav />
      <main className="podcast-main">
        <div className="bulk-upload-header">
          <h2 className="podcast-section-title">Bulk Upload</h2>
          <Link to="/admin/posts" className="pod-btn pod-btn-secondary">
            Single upload
          </Link>
        </div>
        <BulkUploadForm />
      </main>
    </div>
  );
};

export default BulkUpload;
