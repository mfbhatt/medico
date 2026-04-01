import React from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/form/Button';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-800 mb-4">404</h1>
        <p className="text-2xl font-semibold text-gray-700 mb-2">Page Not Found</p>
        <p className="text-gray-600 mb-8">The page you're looking for doesn't exist.</p>
        <Button 
          variant="primary" 
          size="lg"
          onClick={() => navigate('/')}
        >
          Go Back Home
        </Button>
      </div>
    </div>
  );
};

export default NotFoundPage;
