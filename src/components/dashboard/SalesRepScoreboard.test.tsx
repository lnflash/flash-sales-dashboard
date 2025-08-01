import { render, screen } from '@testing-library/react';
import SalesRepScoreboard from './SalesRepScoreboard';
import { SalesRepStats } from '@/utils/rep-stats-calculator';

describe('SalesRepScoreboard', () => {
  const mockRepStats: SalesRepStats[] = [
    {
      username: 'johndoe',
      totalSubmissions: 25,
      signedUp: 15,
      conversionRate: 60,
      avgInterestLevel: 4.2,
      totalInterestScore: 105,
      packageSeen: 20,
      packageSeenRate: 80
    },
    {
      username: 'janedoe',
      totalSubmissions: 20,
      signedUp: 10,
      conversionRate: 50,
      avgInterestLevel: 3.8,
      totalInterestScore: 76,
      packageSeen: 15,
      packageSeenRate: 75
    },
    {
      username: 'bobsmith',
      totalSubmissions: 18,
      signedUp: 8,
      conversionRate: 44.4,
      avgInterestLevel: 3.5,
      totalInterestScore: 63,
      packageSeen: 12,
      packageSeenRate: 66.7
    },
  ];

  test('renders scoreboard with rep stats', () => {
    render(<SalesRepScoreboard data={mockRepStats} isLoading={false} />);
    
    // Check if title is rendered
    expect(screen.getByText('Sales Rep Scoreboard')).toBeInTheDocument();
    
    // Check if all reps are displayed
    expect(screen.getByText('johndoe')).toBeInTheDocument();
    expect(screen.getByText('janedoe')).toBeInTheDocument();
    expect(screen.getByText('bobsmith')).toBeInTheDocument();
    
    // Check if metrics are displayed
    expect(screen.getByText('25')).toBeInTheDocument(); // total submissions for johndoe
    expect(screen.getByText('10')).toBeInTheDocument(); // signups for janedoe
    expect(screen.getByText('44%')).toBeInTheDocument(); // conversion rate for bobsmith (rounded)
  });

  test('renders loading state', () => {
    render(<SalesRepScoreboard data={[]} isLoading={true} />);
    
    // Check if loading state is rendered
    expect(screen.getByText('Sales Rep Scoreboard')).toBeInTheDocument();
    expect(screen.queryByText('johndoe')).not.toBeInTheDocument(); // should not be rendered
    
    // Check for elements that indicate loading state
    const loadingElements = document.querySelectorAll('.animate-pulse');
    expect(loadingElements.length).toBeGreaterThan(0);
  });
  
  test('renders empty state when no data', () => {
    render(<SalesRepScoreboard data={[]} isLoading={false} />);
    
    // Check if table headers are still rendered
    expect(screen.getByText('Sales Rep Scoreboard')).toBeInTheDocument();
    
    // Check if the table is empty (no data rows)
    expect(screen.queryByText('johndoe')).not.toBeInTheDocument();
  });
});