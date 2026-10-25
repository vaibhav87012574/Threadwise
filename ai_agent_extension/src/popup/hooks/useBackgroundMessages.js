import { useEffect } from 'react';
import { browserAPI } from '../utils/browserAPI.js';
import { NOTIFICATION_TYPES } from '../utils/constants.js';

export const useBackgroundMessages = (onImageCaptured, onShowNotification) => {
  useEffect(() => {
    const messageListener = (message, sender, sendResponse) => {
      console.log('Popup received message:', message);
      
      if (message.action === 'capturedImage') {
        console.log('Processing captured image:', message.imageData);
        
        const imageData = {
          data: message.imageData.data,
          type: message.imageData.type,
          name: message.imageData.name
        };
        
        // Handle image capture workflow
        onImageCaptured(imageData);
        onShowNotification('Image captured! Add your question and send.', NOTIFICATION_TYPES.SUCCESS);
      }
      
      // CRITICAL: Always send response
      if (sendResponse) {
        sendResponse({ received: true });
      }
    };

    browserAPI.runtime.onMessage.addListener(messageListener);
    
    return () => {
      browserAPI.runtime.onMessage.removeListener(messageListener);
    };
  }, [onImageCaptured, onShowNotification]);
};
