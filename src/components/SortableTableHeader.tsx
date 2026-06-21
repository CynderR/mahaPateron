import React from 'react';
import { AdminSortDir, AdminSortField } from '../utils/adminTableHelpers';

interface SortableTableHeaderProps {
  label: string;
  field: AdminSortField;
  activeField: AdminSortField | null;
  activeDir: AdminSortDir;
  onSort: (field: AdminSortField) => void;
}

const SortableTableHeader: React.FC<SortableTableHeaderProps> = ({
  label,
  field,
  activeField,
  activeDir,
  onSort
}) => (
  <th scope="col">
    <button type="button" className="pod-table-sort-btn" onClick={() => onSort(field)}>
      {label}
      {activeField === field && (
        <span className="pod-table-sort-indicator" aria-hidden>
          {activeDir === 'asc' ? ' ↑' : ' ↓'}
        </span>
      )}
    </button>
  </th>
);

export default SortableTableHeader;
