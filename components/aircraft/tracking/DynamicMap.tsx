import dynamic from 'next/dynamic';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

const LeafletMap = dynamic(
  () => import('./LeafletMap').then(mod => mod.default),
  { 
    loading: () => (
      <div className="flex items-center justify-center h-[800px] bg-gray-100 rounded-lg">
        <LoadingSpinner />
      </div>
    ),
    ssr: false
  }
);

export default LeafletMap;