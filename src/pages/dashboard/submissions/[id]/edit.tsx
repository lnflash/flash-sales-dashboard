import { useRouter } from 'next/router';
import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useSubmissionDetail } from '@/hooks/useSubmissionDetail';
import Link from 'next/link';
import { ChevronLeftIcon } from '@heroicons/react/24/outline';
import { updateSubmission } from '@/lib/api';
import { Submission } from '@/types/submission';

export default function EditSubmissionPage() {
  const router = useRouter();
  const { id } = router.query;
  
  const submissionId = id ? parseInt(id as string) : 0;
  const { submission, isLoading, error, mutate } = useSubmissionDetail(submissionId);
  
  const [formState, setFormState] = useState<Partial<Submission>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Only update formState when submission data loads for the first time
  if (submission && Object.keys(formState).length === 0) {
    setFormState(submission);
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const isChecked = (e.target as HTMLInputElement).checked;
      setFormState(prev => ({ ...prev, [name]: isChecked }));
    } else if (name === 'interestLevel') {
      setFormState(prev => ({ ...prev, [name]: parseInt(value) }));
    } else {
      setFormState(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      if (!submissionId || !formState.ownerName) {
        throw new Error('Invalid form data');
      }

      await updateSubmission(submissionId, formState);
      
      // Update the cache
      mutate();
      
      setSuccessMessage('Submission updated successfully!');
      
      // Redirect after a short delay
      setTimeout(() => {
        router.push(`/dashboard/submissions/${submissionId}`);
      }, 1500);
      
    } catch (err) {
      console.error('Error updating submission:', err);
      setErrorMessage('Failed to update submission. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (error) {
    return (
      <DashboardLayout title="Submission Not Found">
        <div className="max-w-3xl mx-auto">
          <div className="bg-flash-dark-3 rounded-lg p-6 shadow-md text-center">
            <h2 className="text-xl font-semibold text-red-400 mb-3">Error</h2>
            <p className="text-gray-400 mb-4">
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
    <DashboardLayout title={isLoading ? 'Loading...' : `Edit Submission: ${submission?.ownerName}`}>
      <div className="max-w-3xl mx-auto">
        <div className="mb-4">
          <Link
            href={`/dashboard/submissions/${submissionId}`}
            className="inline-flex items-center text-flash-green hover:text-flash-green-light"
          >
            <ChevronLeftIcon className="h-5 w-5 mr-1" />
            Back to submission
          </Link>
        </div>

        {isLoading ? (
          <div className="bg-flash-dark-3 rounded-lg p-6 shadow-md animate-pulse">
            <div className="h-8 bg-flash-dark-2 rounded w-3/4 mb-6"></div>
            <div className="space-y-4">
              {[...Array(6)].map((_, i) => (
                <div key={i}>
                  <div className="h-5 bg-flash-dark-2 rounded w-1/3 mb-2"></div>
                  <div className="h-10 bg-flash-dark-2 rounded w-full"></div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-flash-dark-3 rounded-lg p-6 shadow-md">
            <h1 className="text-xl font-bold text-white mb-6">Edit Submission</h1>
            
            {errorMessage && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500 text-red-400 rounded-md">
                {errorMessage}
              </div>
            )}
            
            {successMessage && (
              <div className="mb-4 p-3 bg-flash-green/20 border border-flash-green text-flash-green rounded-md">
                {successMessage}
              </div>
            )}
            
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="ownerName" className="block text-gray-400 text-sm font-medium mb-2">
                    Business Name *
                  </label>
                  <input
                    type="text"
                    id="ownerName"
                    name="ownerName"
                    value={formState.ownerName || ''}
                    onChange={handleInputChange}
                    required
                    className="w-full bg-flash-dark-2 border border-flash-dark-1 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-flash-green"
                  />
                </div>
                
                <div>
                  <label htmlFor="phoneNumber" className="block text-gray-400 text-sm font-medium mb-2">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    id="phoneNumber"
                    name="phoneNumber"
                    value={formState.phoneNumber || ''}
                    onChange={handleInputChange}
                    className="w-full bg-flash-dark-2 border border-flash-dark-1 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-flash-green"
                  />
                </div>
                
                <div>
                  <label htmlFor="username" className="block text-gray-400 text-sm font-medium mb-2">
                    Sales Rep
                  </label>
                  <input
                    type="text"
                    id="username"
                    name="username"
                    value={formState.username || ''}
                    onChange={handleInputChange}
                    className="w-full bg-flash-dark-2 border border-flash-dark-1 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-flash-green"
                  />
                </div>
                
                <div>
                  <label htmlFor="interestLevel" className="block text-gray-400 text-sm font-medium mb-2">
                    Interest Level
                  </label>
                  <select
                    id="interestLevel"
                    name="interestLevel"
                    value={formState.interestLevel || 0}
                    onChange={handleInputChange}
                    className="w-full bg-flash-dark-2 border border-flash-dark-1 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-flash-green"
                  >
                    <option value="1">1 - Not Interested</option>
                    <option value="2">2 - Slightly Interested</option>
                    <option value="3">3 - Moderately Interested</option>
                    <option value="4">4 - Very Interested</option>
                    <option value="5">5 - Extremely Interested</option>
                  </select>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="packageSeen"
                    name="packageSeen"
                    checked={formState.packageSeen || false}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-flash-green focus:ring-flash-green border-gray-300 rounded"
                  />
                  <label htmlFor="packageSeen" className="ml-2 block text-gray-400 text-sm font-medium">
                    Package Seen by Owner
                  </label>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="signedUp"
                    name="signedUp"
                    checked={formState.signedUp || false}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-flash-green focus:ring-flash-green border-gray-300 rounded"
                  />
                  <label htmlFor="signedUp" className="ml-2 block text-gray-400 text-sm font-medium">
                    Signed Up
                  </label>
                </div>
                
                <div className="md:col-span-2">
                  <label htmlFor="decisionMakers" className="block text-gray-400 text-sm font-medium mb-2">
                    Other Decision Makers
                  </label>
                  <input
                    type="text"
                    id="decisionMakers"
                    name="decisionMakers"
                    value={formState.decisionMakers || ''}
                    onChange={handleInputChange}
                    className="w-full bg-flash-dark-2 border border-flash-dark-1 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-flash-green"
                  />
                </div>
                
                <div className="md:col-span-2">
                  <label htmlFor="specificNeeds" className="block text-gray-400 text-sm font-medium mb-2">
                    Specific Needs
                  </label>
                  <textarea
                    id="specificNeeds"
                    name="specificNeeds"
                    value={formState.specificNeeds || ''}
                    onChange={handleInputChange}
                    rows={4}
                    className="w-full bg-flash-dark-2 border border-flash-dark-1 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-flash-green"
                  />
                </div>
              </div>
              
              <div className="mt-6 flex space-x-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-4 py-2 bg-flash-green text-white rounded-md hover:bg-flash-green-light transition-colors ${
                    isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
                
                <Link
                  href={`/dashboard/submissions/${submissionId}`}
                  className="px-4 py-2 border border-gray-500 text-gray-400 rounded-md hover:bg-flash-dark-2 transition-colors"
                >
                  Cancel
                </Link>
              </div>
            </form>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}