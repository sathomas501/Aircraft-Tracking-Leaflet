import dynamic from 'next/dynamic';

const MapWithNoSSR = dynamic(
  () =>
    import('../components/aircraft/tracking/mapWrapper').then(
      (mod) => mod.MapWrapper
    ),
  {
    ssr: false, // ✅ Still prevents server-side rendering
  }
);

export default function MapPage() {
  return (
    <div className="w-full h-screen">
      <MapWithNoSSR
        initialAircraft={[]}
        manufacturers={[]}
        onError={(error) => console.error(error)}
      />
    </div>
  );
}
