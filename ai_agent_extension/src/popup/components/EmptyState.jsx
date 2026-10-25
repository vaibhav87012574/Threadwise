import React from 'react';

const EmptyState = () => {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">🛒</div>
      <p style={{ margin: 0, fontSize: '1.125rem', fontWeight: 500 }}>
        Start shopping with AI
      </p>
      <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem' }}>
        Upload product images or ask for recommendations!
      </p>
    </div>
  );
};

export default EmptyState;
