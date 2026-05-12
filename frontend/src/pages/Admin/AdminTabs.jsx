import { NavLink } from 'react-router-dom';

export default function AdminTabs() {
  const cls = ({ isActive }) => `seg ${isActive ? 'active' : ''}`;
  return (
    <div className="segmented mb-4">
      <NavLink to="/admin/businesses" className={cls}>Businesses</NavLink>
      <NavLink to="/admin/customers" className={cls}>Customers</NavLink>
    </div>
  );
}
