// pages/index.tsx
import { GetServerSideProps } from 'next';
import { QueryClient, dehydrate } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import {LoadingSpinner} from '@/components/shared/LoadingSpinner';

// Dynamically import the map component with SSR disabled
const DynamicAircraftTracking = dynamic(
  () => import('@/components/aircraft/tracking/LeafletMap'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-[800px] bg-gray-100 rounded-lg">
        <LoadingSpinner size="lg" message="Loading map..." />
      </div>
    )
  }
);

export default function HomePage() {
  return (
    <div className="container mx-auto p-4">
      <DynamicAircraftTracking />
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });

  try {
    // Initialize any data you need here
    // Example: Initial aircraft data fetch
    /*
    await queryClient.prefetchQuery(
      ['aircraftData'],
      async () => {
        const response = await fetch('your-api-endpoint');
        return response.json();
      }
    );
    */

    return {
      props: {
        dehydratedState: dehydrate(queryClient),
      },
    };
  } catch (error) {
    console.error('Error in getServerSideProps:', error);
    return {
      props: {
        dehydratedState: dehydrate(queryClient),
      },
    };
  } finally {
    queryClient.clear();
  }
};