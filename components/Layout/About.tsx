import type { NextPage } from 'next';
import Layout from '../Layout/Layout'; // Correct import for Layout
import { Card, CardHeader, CardContent } from '../ui/Card';

const About: NextPage = () => {
  return (
    <Layout title="About - Aircraft Tracking System">
      <Card>
        <CardHeader>
          <h1 className="text-2xl font-bold">About</h1>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">
            Our aircraft tracking system provides real-time monitoring of flights and comprehensive data insights to ensure efficient and accurate tracking.
          </p>
        </CardContent>
      </Card>
    </Layout>
  );
};

export default About;
