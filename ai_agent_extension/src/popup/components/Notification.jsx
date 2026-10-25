import React from 'react';
import { NOTIFICATION_TYPES } from '../utils/constants.js';

const Notification = ({ notification, onClose }) => {
  if (!notification) return null;

  const { text, type } = notification;

  const getBackgroundColor = () => {
    switch (type) {
      case NOTIFICATION_TYPES.SUCCESS:
        return '#10b981';
      case NOTIFICATION_TYPES.ERROR:
        return '#ef4444';
      default:
        return '#3b82f6';
    }
  };

  return (
    <div 
      style={{
        position: 'fixed',
        top: '10px',
        right: '10px',
        background: getBackgroundColor(),
        color: 'white',
        padding: '8px 12px',
        borderRadius: '6px',
        fontSize: '12px',
        zIndex: 1000,
        maxWidth: '250px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        cursor: 'pointer'
      }}
      onClick={onClose}
    >
      {text}
    </div>
  );
};

export default Notification;
