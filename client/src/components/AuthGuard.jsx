import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AuthGuard({ children, minPlan = null }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (minPlan) {
    const ranks = { free: 0, pro: 1, business: 2 };
    if ((ranks[user.plan] ?? 0) < (ranks[minPlan] ?? 0)) {
      return <Navigate to="/pricing" state={{ reason: 'upgrade_required' }} replace />;
    }
  }

  return children;
}
