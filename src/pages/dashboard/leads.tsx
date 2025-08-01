import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import LeadWorkflowPipeline from '@/components/sales-intelligence/LeadWorkflowPipeline';
import LeadQualificationWizard from '@/components/sales-intelligence/LeadQualificationWizard';
import DealProbabilityAnalyzer from '@/components/sales-intelligence/DealProbabilityAnalyzer';
import FollowUpRecommendations from '@/components/sales-intelligence/FollowUpRecommendations';
import LeadAssignment from '@/components/sales-intelligence/LeadAssignment';
import TerritoryDashboard from '@/components/sales-intelligence/TerritoryDashboard';
import { useUserSubmissions } from '@/hooks/useUserSubmissions';
import { LeadWorkflow, LeadStage } from '@/types/lead-qualification';
import { Submission } from '@/types/submission';
import { calculateDealProbability } from '@/utils/deal-probability';
import { JamaicaParish } from '@/types/lead-routing';
import { getUserFromStorage } from '@/lib/auth';
import { hasPermission } from '@/types/roles';
import { 
  PlusIcon, 
  FunnelIcon,
  ClipboardDocumentCheckIcon,
  ArrowTrendingUpIcon,
  ChartBarIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';

// Lead status options that should replace the signed up checkbox
export type LeadStatus = 'canvas' | 'contacted' | 'prospect' | 'opportunity' | 'signed_up';

// Helper function to determine if a lead is active (created/edited in last 30 days)
const isActiveLead = (submission: Submission): boolean => {
  const submissionDate = new Date(submission.timestamp);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  return submissionDate >= thirtyDaysAgo && submission.signedUp !== true;
};

// Helper function to determine if a lead is new (created in last 7 days)
const isNewLead = (submission: Submission): boolean => {
  const submissionDate = new Date(submission.timestamp);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  return submissionDate >= sevenDaysAgo;
};

// Helper function to determine if a lead is stale (30+ days old and not signed up)
const isStaleLead = (submission: Submission): boolean => {
  const submissionDate = new Date(submission.timestamp);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  return submissionDate < thirtyDaysAgo && submission.signedUp !== true;
};

// Helper function to determine lead stage based on submission data
const getLeadStage = (submission: Submission): LeadStage => {
  // TODO: Once we add the status field, use that instead
  if (submission.signedUp) return 'customer';
  if (submission.interestLevel >= 4 && submission.packageSeen) return 'opportunity';
  if (submission.interestLevel >= 3) return 'qualified';
  if (submission.phoneNumber) return 'contacted';
  return 'new';
};

// Helper function to calculate qualification score
const calculateQualificationScore = (submission: Submission): number => {
  let score = 0;
  
  // Interest level (0-50 points)
  score += (submission.interestLevel / 5) * 50;
  
  // Package seen (20 points)
  if (submission.packageSeen) score += 20;
  
  // Has decision makers (10 points)
  if (submission.decisionMakers) score += 10;
  
  // Signed up (20 points)
  if (submission.signedUp) score += 20;
  
  return Math.round(score);
};

// Helper function to convert submission to workflow
const submissionToWorkflow = (submission: Submission): LeadWorkflow => {
  const stage = getLeadStage(submission);
  const score = calculateQualificationScore(submission);
  
  const workflow: LeadWorkflow = {
    id: submission.id,
    submissionId: submission.id,
    currentStage: stage,
    qualificationScore: score,
    criteria: {
      hasbudget: submission.interestLevel >= 3,
      hasAuthority: !!submission.decisionMakers,
      hasNeed: submission.interestLevel >= 2,
      hasTimeline: submission.interestLevel >= 4,
    },
    stageHistory: [],
    nextActions: [],
    assignedTo: submission.username || 'Unassigned',
    createdAt: submission.timestamp,
    updatedAt: submission.timestamp,
  };
  
  // Add stage history based on current stage
  if (stage !== 'new') {
    workflow.stageHistory.push({
      fromStage: 'new',
      toStage: 'contacted',
      transitionDate: submission.timestamp,
      performedBy: submission.username || 'System',
    });
  }
  
  if (stage === 'qualified' || stage === 'opportunity' || stage === 'customer') {
    workflow.stageHistory.push({
      fromStage: 'contacted',
      toStage: 'qualified',
      transitionDate: submission.timestamp,
      performedBy: submission.username || 'System',
    });
  }
  
  if (stage === 'opportunity' || stage === 'customer') {
    workflow.stageHistory.push({
      fromStage: 'qualified',
      toStage: 'opportunity',
      transitionDate: submission.timestamp,
      performedBy: submission.username || 'System',
    });
  }
  
  if (stage === 'customer') {
    workflow.stageHistory.push({
      fromStage: 'opportunity',
      toStage: 'customer',
      transitionDate: submission.timestamp,
      performedBy: submission.username || 'System',
    });
  }
  
  // Add next actions based on stage
  switch (stage) {
    case 'new':
      workflow.nextActions = ['Make initial contact', 'Send introductory email'];
      break;
    case 'contacted':
      workflow.nextActions = ['Schedule discovery call', 'Send product information'];
      break;
    case 'qualified':
      workflow.nextActions = ['Schedule product demo', 'Prepare custom proposal'];
      break;
    case 'opportunity':
      workflow.nextActions = ['Finalize proposal', 'Get stakeholder buy-in'];
      break;
    case 'customer':
      workflow.nextActions = ['Send onboarding materials', 'Schedule implementation'];
      break;
  }
  
  return workflow;
};

export default function LeadsPage() {
  const [selectedStage, setSelectedStage] = useState<LeadStage | null>(null);
  const [showQualificationWizard, setShowQualificationWizard] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState<LeadWorkflow | null>(null);
  const [showProbabilityAnalyzer, setShowProbabilityAnalyzer] = useState(false);
  const [showLeadAssignment, setShowLeadAssignment] = useState(false);
  const [leadToAssign, setLeadToAssign] = useState<number | string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [selectedTerritory, setSelectedTerritory] = useState<string>('');
  
  useEffect(() => {
    const currentUser = getUserFromStorage();
    if (currentUser) {
      setUser(currentUser);
    }
  }, []);
  
  // Determine which username to filter by
  const canViewAllReps = user?.role && hasPermission(user.role, 'canViewAllReps');
  const usernameToFilter = canViewAllReps ? undefined : user?.username;
  
  // Debug logging
  console.log('Lead Management Debug:', {
    user: user,
    canViewAllReps,
    usernameToFilter,
  });
  
  // Fetch all submissions for lead management
  const { data, isLoading } = useUserSubmissions(usernameToFilter);
  const submissions = data?.submissions || [];
  const totalCount = data?.count || 0;
  
  console.log('[LeadManagement] useUserSubmissions returned:', {
    data,
    submissionsLength: submissions.length,
    totalCount,
    isLoading,
    usernameToFilter
  });
  
  // Convert submissions to workflows
  const workflows = submissions.map(submissionToWorkflow);

  // Filter workflows by selected stage
  const filteredWorkflows = selectedStage
    ? workflows.filter(w => w.currentStage === selectedStage)
    : workflows;

  // Get unqualified submissions (those without workflows)
  const unqualifiedSubmissions = submissions.filter(
    sub => !workflows.find(w => w.submissionId === sub.id)
  );

  const handleQualifyLead = (submission: Submission) => {
    setSelectedSubmission(submission);
    setShowQualificationWizard(true);
  };

  const handleQualificationComplete = (workflow: Partial<LeadWorkflow>) => {
    console.log('New workflow created:', workflow);
    // In production, this would save to API
    setShowQualificationWizard(false);
    setSelectedSubmission(null);
  };

  // Calculate lead statistics
  const activeLeads = submissions.filter(isActiveLead);
  const newLeads = submissions.filter(isNewLead);
  const staleLeads = submissions.filter(isStaleLead);
  const signedUpLeads = submissions.filter(s => s.signedUp);
  
  const stats = {
    totalLeads: submissions.length,
    activeLeads: activeLeads.length,
    newLeads: newLeads.length,
    staleLeads: staleLeads.length,
    conversionRate: submissions.length > 0 
      ? (signedUpLeads.length / submissions.length * 100).toFixed(1)
      : '0',
  };

  // Show loading state while user data or submissions are loading
  if (!user || isLoading) {
    return (
      <DashboardLayout title="Lead Management">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-flash-green"></div>
            <p className="mt-4 text-light-text-secondary">Loading lead data...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Lead Management">
      {/* Debug Info - Remove in production */}
      {process.env.NODE_ENV === 'development' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 text-xs font-mono">
          <p className="font-semibold mb-2">Debug Info:</p>
          <p>User: {JSON.stringify(user)}</p>
          <p>Can view all reps: {canViewAllReps ? 'true' : 'false'}</p>
          <p>Username to filter: {usernameToFilter || 'ALL'}</p>
          <p>Total submissions: {submissions.length}</p>
          <p>Total count from DB: {totalCount}</p>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm p-6 border border-light-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-light-text-secondary">Total Leads</p>
              <p className="text-2xl font-bold text-light-text-primary mt-1">{stats.totalLeads}</p>
            </div>
            <FunnelIcon className="w-8 h-8 text-flash-green opacity-50" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-light-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-light-text-secondary">Active Leads</p>
              <p className="text-2xl font-bold text-light-text-primary mt-1">{stats.activeLeads}</p>
              <p className="text-xs text-light-text-tertiary">Last 30 days</p>
            </div>
            <ClipboardDocumentCheckIcon className="w-8 h-8 text-blue-500 opacity-50" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-light-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-light-text-secondary">New Leads</p>
              <p className="text-2xl font-bold text-light-text-primary mt-1">{stats.newLeads}</p>
              <p className="text-xs text-light-text-tertiary">Last 7 days</p>
            </div>
            <PlusIcon className="w-8 h-8 text-green-500 opacity-50" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-light-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-light-text-secondary">Stale Leads</p>
              <p className="text-2xl font-bold text-light-text-primary mt-1">{stats.staleLeads}</p>
              <p className="text-xs text-light-text-tertiary">30+ days</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center">
              <span className="text-sm font-bold text-yellow-600">!</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-light-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-light-text-secondary">Conversion Rate</p>
              <p className="text-2xl font-bold text-light-text-primary mt-1">{stats.conversionRate}%</p>
            </div>
            <ArrowTrendingUpIcon className="w-8 h-8 text-green-500 opacity-50" />
          </div>
        </div>
      </div>

      {/* Territory Dashboard */}
      <div className="mb-8">
        <TerritoryDashboard 
          salesReps={(() => {
            // Group active submissions by rep and territory
            const repMap = new Map<string, any>();
            
            // Only process active leads for territory dashboard
            activeLeads.forEach(sub => {
              const repName = sub.username || 'Unassigned';
              const territory = sub.territory || 'Unassigned';
              const key = `${repName}-${territory}`;
              
              if (!repMap.has(key)) {
                repMap.set(key, {
                  id: key,
                  name: repName,
                  territory: territory as JamaicaParish | 'Unassigned',
                  activeLeads: 0,
                  totalRevenue: 0,
                  conversionRate: 0,
                });
              }
              
              const rep = repMap.get(key)!;
              rep.activeLeads += 1;
            });
            
            // Add revenue and conversion data from all submissions
            submissions.forEach(sub => {
              const repName = sub.username || 'Unassigned';
              const territory = sub.territory || 'Unassigned';
              const key = `${repName}-${territory}`;
              
              if (repMap.has(key) && sub.signedUp) {
                repMap.get(key)!.totalRevenue += 5000; // Assuming $5000 per conversion
              }
            });
            
            // Calculate conversion rates based on all submissions
            repMap.forEach(rep => {
              const repSubmissions = submissions.filter(s => 
                (s.username || 'Unassigned') === rep.name && 
                (s.territory || 'Unassigned') === rep.territory
              );
              const conversions = repSubmissions.filter(s => s.signedUp).length;
              rep.conversionRate = repSubmissions.length > 0 
                ? (conversions / repSubmissions.length) * 100 
                : 0;
            });
            
            // Filter out territories with zero active leads
            return Array.from(repMap.values()).filter(rep => rep.activeLeads > 0);
          })()}
          onTerritoryClick={(parish) => {
            setSelectedTerritory(parish);
            console.log(`Selected territory: ${parish}`);
          }}
        />
      </div>

      {/* Lead Pipeline */}
      <div className="mb-8">
        <LeadWorkflowPipeline 
          workflows={workflows}
          onStageClick={(stage, stageWorkflows) => {
            setSelectedStage(stage);
            console.log(`Selected ${stage} with ${stageWorkflows.length} leads`);
          }}
        />
      </div>

      {/* Qualified Leads with Probability */}
      <div className="mb-8 bg-white rounded-lg shadow-sm p-6 border border-light-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-light-text-primary">
            Active Opportunities
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workflows
            .filter(w => ['qualified', 'opportunity'].includes(w.currentStage))
            .map(workflow => {
              const submission = submissions.find(s => s.id === workflow.submissionId) || {
                id: workflow.submissionId,
                ownerName: `Lead ${workflow.submissionId}`,
                packageSeen: true,
                interestLevel: 4,
                signedUp: false,
                timestamp: workflow.createdAt,
              };
              const probability = calculateDealProbability(workflow, submission);
              
              return (
                <div
                  key={workflow.id}
                  className="p-4 bg-light-bg-secondary rounded-lg border border-light-border hover:border-flash-green/50 transition-all cursor-pointer"
                  onClick={() => {
                    setSelectedWorkflow(workflow);
                    setSelectedSubmission(submission);
                    setShowProbabilityAnalyzer(true);
                  }}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-medium text-light-text-primary">
                        {submission.ownerName}
                      </p>
                      <p className="text-xs text-light-text-secondary">
                        {workflow.assignedTo || 'Unassigned'}
                      </p>
                    </div>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      workflow.currentStage === 'opportunity'
                        ? 'bg-purple-100 text-purple-800 border border-purple-300'
                        : 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                    }`}>
                      {workflow.currentStage}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-light-text-secondary">Close Probability</span>
                      <span className="text-sm font-semibold text-light-text-primary">
                        {probability.finalProbability}%
                      </span>
                    </div>
                    
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all ${
                          probability.finalProbability >= 70 ? 'bg-green-500' :
                          probability.finalProbability >= 40 ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${probability.finalProbability}%` }}
                      />
                    </div>

                    <button className="mt-2 text-xs text-flash-green hover:text-flash-green-light flex items-center">
                      <ChartBarIcon className="w-3 h-3 mr-1" />
                      View Analysis
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Follow-up Recommendations */}
      {workflows.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-light-text-primary mb-4">
            Today's Priority Actions
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {workflows
              .filter(w => ['contacted', 'qualified', 'opportunity'].includes(w.currentStage))
              .slice(0, 2)
              .map(workflow => {
                const submission = submissions.find(s => s.id === workflow.submissionId) || {
                  id: workflow.submissionId,
                  ownerName: `Lead ${workflow.submissionId}`,
                  packageSeen: true,
                  interestLevel: 4,
                  signedUp: false,
                  timestamp: workflow.createdAt,
                };
                
                return (
                  <FollowUpRecommendations
                    key={workflow.id}
                    workflow={workflow}
                    submission={submission}
                    onActionTaken={(action) => {
                      console.log('Action taken:', action);
                    }}
                  />
                );
              })}
          </div>
        </div>
      )}

      {/* Unqualified Leads Section */}
      {unqualifiedSubmissions.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6 border border-light-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-light-text-primary">
              Unqualified Leads ({unqualifiedSubmissions.length})
            </h3>
            <button className="text-sm text-flash-green hover:text-flash-green-light">
              View All
            </button>
          </div>

          <div className="space-y-3">
            {unqualifiedSubmissions.slice(0, 5).map(submission => (
              <div 
                key={submission.id}
                className="flex items-center justify-between p-4 bg-light-bg-secondary rounded-lg"
              >
                <div className="flex-1">
                  <p className="font-medium text-light-text-primary">{submission.ownerName}</p>
                  <p className="text-sm text-light-text-secondary">
                    Interest: {submission.interestLevel}/5 • 
                    {submission.packageSeen ? ' Package Viewed' : ' Not Viewed'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setLeadToAssign(submission.id);
                      setShowLeadAssignment(true);
                    }}
                    className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center"
                  >
                    <UserGroupIcon className="w-4 h-4 mr-1" />
                    Assign
                  </button>
                  <button
                    onClick={() => handleQualifyLead(submission)}
                    className="px-4 py-2 bg-flash-green text-white rounded-md hover:bg-flash-green-light transition-colors flex items-center"
                  >
                    <PlusIcon className="w-4 h-4 mr-1" />
                    Qualify
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stale Leads Section */}
      {staleLeads.length > 0 && (
        <div className="mt-8 bg-white rounded-lg shadow-sm p-6 border border-yellow-300">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-light-text-primary">
                Stale Leads ({staleLeads.length})
              </h3>
              <p className="text-sm text-light-text-secondary">
                Leads that haven't been updated in over 30 days
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                Needs Attention
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-light-border">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-light-text-secondary uppercase tracking-wider">
                    Business Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-light-text-secondary uppercase tracking-wider">
                    Sales Rep
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-light-text-secondary uppercase tracking-wider">
                    Territory
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-light-text-secondary uppercase tracking-wider">
                    Last Contact
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-light-text-secondary uppercase tracking-wider">
                    Interest
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-light-text-secondary uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-light-border">
                {staleLeads.slice(0, 10).map(lead => {
                  const daysSinceContact = Math.floor(
                    (new Date().getTime() - new Date(lead.timestamp).getTime()) / (1000 * 60 * 60 * 24)
                  );
                  
                  return (
                    <tr key={lead.id} className="hover:bg-light-bg-secondary">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <p className="text-sm font-medium text-light-text-primary">
                          {lead.ownerName}
                        </p>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <p className="text-sm text-light-text-primary">
                          {lead.username || 'Unassigned'}
                        </p>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <p className="text-sm text-light-text-primary">
                          {lead.territory || 'N/A'}
                        </p>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <p className="text-sm text-light-text-primary">
                          {daysSinceContact} days ago
                        </p>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-16 bg-light-bg-tertiary rounded-full h-2">
                            <div
                              className="bg-gradient-to-r from-flash-green to-flash-yellow h-2 rounded-full"
                              style={{ width: `${(lead.interestLevel / 5) * 100}%` }}
                            />
                          </div>
                          <span className="ml-2 text-sm text-light-text-primary">{lead.interestLevel}/5</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleQualifyLead(lead)}
                          className="text-sm text-flash-green hover:text-flash-green-light font-medium"
                        >
                          Re-engage
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {staleLeads.length > 10 && (
            <div className="mt-4 text-center">
              <button className="text-sm text-flash-green hover:text-flash-green-light font-medium">
                View all {staleLeads.length} stale leads
              </button>
            </div>
          )}
        </div>
      )}

      {/* Qualification Wizard Modal */}
      {showQualificationWizard && selectedSubmission && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <LeadQualificationWizard
              submission={selectedSubmission}
              onComplete={handleQualificationComplete}
              onCancel={() => {
                setShowQualificationWizard(false);
                setSelectedSubmission(null);
              }}
            />
          </div>
        </div>
      )}

      {/* Deal Probability Analyzer Modal */}
      {showProbabilityAnalyzer && selectedWorkflow && selectedSubmission && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <DealProbabilityAnalyzer
              workflow={selectedWorkflow}
              submission={selectedSubmission}
              onClose={() => {
                setShowProbabilityAnalyzer(false);
                setSelectedWorkflow(null);
                setSelectedSubmission(null);
              }}
            />
          </div>
        </div>
      )}

      {/* Lead Assignment Modal */}
      {showLeadAssignment && leadToAssign && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <LeadAssignment
              leadId={leadToAssign}
              onAssign={(repId, territory) => {
                console.log(`Assigned lead ${leadToAssign} to ${repId} in ${territory}`);
                setShowLeadAssignment(false);
                setLeadToAssign(null);
                // In production, this would update the lead assignment via API
              }}
              onCancel={() => {
                setShowLeadAssignment(false);
                setLeadToAssign(null);
              }}
            />
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}