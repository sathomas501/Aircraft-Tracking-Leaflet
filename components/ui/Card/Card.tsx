import * as React from 'react';

interface CardProps {
  children?: React.ReactNode;  // Made children optional
  className?: string;
}

type CardComponent = {
  ({ children, className }: CardProps): React.ReactElement;
  displayName?: string;
}

const Card: CardComponent = ({ children, className = '' }) => {
  return (
    <div className={`bg-white rounded-lg shadow-lg ${className}`}>
      {children}
    </div>
  );
};

const CardHeader: CardComponent = ({ children, className = '' }) => {
  return (
    <div className={`p-6 border-b ${className}`}>
      {children}
    </div>
  );
};

const CardContent: CardComponent = ({ children, className = '' }) => {
  return (
    <div className={`p-6 ${className}`}>
      {children}
    </div>
  );
};

Card.displayName = 'Card';
CardHeader.displayName = 'CardHeader';
CardContent.displayName = 'CardContent';

export { Card, CardHeader, CardContent };
export type { CardProps };