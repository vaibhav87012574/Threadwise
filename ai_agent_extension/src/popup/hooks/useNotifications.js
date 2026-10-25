import { useState, useCallback } from 'react';
import { NOTIFICATION_TYPES } from '../utils/constants.js';

export const useNotifications = () => {
  const [notification, setNotification] = useState(null);

  const showNotification = useCallback((text, type = NOTIFICATION_TYPES.INFO) => {
    setNotification({ text, type });
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      setNotification(null);
    }, 3000);
  }, []);

  const hideNotification = useCallback(() => {
    setNotification(null);
  }, []);

  return {
    notification,
    showNotification,
    hideNotification
  };
};
