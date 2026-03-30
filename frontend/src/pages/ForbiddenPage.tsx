import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/form/Button';

export const ForbiddenPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-800 mb-4">403</h1>
        <p className="text-2xl font-semibold text-gray-700 mb-2">Access Forbidden</p>
        <p className="text-gray-600 mb-8">You don't have permission to access this resource.</p>
        <div className="space-x-4">
          <Button 
            variant="primary" 
            size="lg"
            onClick={() => navigate('/')}
          >
            Go Home
          </Button>
          <Button 
            variant="secondary" 
            size="lg"
            onClick={() => navigate(-1)}
          >
            Go Back
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ForbiddenPage;
