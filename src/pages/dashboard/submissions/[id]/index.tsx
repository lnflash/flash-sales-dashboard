import { useRouter } from 'next/router';
import DashboardLayout from '@/components/layout/DashboardLayout';
import SubmissionDetail from '@/components/submissions/SubmissionDetail';
import { useSubmissionDetail } from '@/hooks/useSubmissionDetail';

export default function SubmissionDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  
  const submissionId = id ? String(id) : '';
  const { submission, isLoading, error } = useSubmissionDetail(submissionId);

  if (error) {
    return (
      <DashboardLayout title="Submission Not Found">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-lg p-6 shadow-md text-center border border-light-border">
            <h2 className="text-xl font-semibold text-red-600 mb-3">Error</h2>
            <p className="text-light-text-secondary mb-4">
              Could not find submission with ID {submissionId}
            </p>
            <button 
              onClick={() => router.push('/dashboard/submissions')}
              className="px-4 py-2 bg-flash-green text-white rounded-md hover:bg-flash-green-light transition-colors"
            >
              Return to Submissions
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={isLoading ? 'Loading...' : `Submission: ${submission?.ownerName}`}>
      {submission ? (
        <SubmissionDetail submission={submission} isLoading={isLoading} />
      ) : isLoading ? (
        <SubmissionDetail
          submission={{
            id: '',
            ownerName: '',
            packageSeen: false,
            interestLevel: 0,
            signedUp: false,
            timestamp: new Date().toISOString(),
          }}
          isLoading={true}
        />
      ) : null}
    </DashboardLayout>
  );
}