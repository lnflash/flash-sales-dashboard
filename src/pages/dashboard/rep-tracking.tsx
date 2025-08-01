import { NextPage } from 'next';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { RepTrackingForm } from '../../components/rep-tracking/RepTrackingForm';
import { RepTrackingTable } from '../../components/rep-tracking/RepTrackingTable';
import { useRepTracking } from '../../hooks/useRepTracking';
import { useState, useEffect } from 'react';
import { getUserFromStorage } from '@/lib/auth';
import { getUserRole, hasPermission } from '@/types/roles';

const RepTrackingPage: NextPage = () => {
  const [filters, setFilters] = useState<{ repName?: string }>({});
  const [canViewAllReps, setCanViewAllReps] = useState(false);
  const { data: trackingData = [], isLoading } = useRepTracking(filters);

  useEffect(() => {
    const user = getUserFromStorage();
    if (user) {
      const role = getUserRole(user.username);
      const canViewAll = hasPermission(role, 'canViewAllReps');
      setCanViewAllReps(canViewAll);
      
      // If user can only view their own data, filter by their username
      if (!canViewAll) {
        setFilters({ repName: user.username });
      }
    }
  }, []);

  return (
    <DashboardLayout title="Rep Performance Tracking">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Section */}
        <div className="lg:col-span-1">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-light-text-primary mb-4">
              Track Weekly Performance
            </h2>
            <p className="text-light-text-secondary text-sm mb-6">
              Record whether reps submitted their Monday update and attended the Tuesday call.
            </p>
          </div>
          <RepTrackingForm />
        </div>

        {/* Table Section */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg p-6 shadow-sm border border-light-border">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-light-text-primary">
                Performance History
              </h2>
              {canViewAllReps && (
                <span className="text-sm text-light-text-secondary bg-light-bg-secondary px-3 py-1 rounded-full">
                  Viewing: All Reps
                </span>
              )}
            </div>
            
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-flash-green mx-auto"></div>
              </div>
            ) : trackingData.length === 0 ? (
              <div className="text-center py-8 text-light-text-tertiary">
                No tracking data available. Start by adding rep performance data.
              </div>
            ) : (
              <RepTrackingTable data={trackingData} />
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default RepTrackingPage;