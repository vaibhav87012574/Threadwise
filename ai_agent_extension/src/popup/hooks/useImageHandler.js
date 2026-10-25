import { useState, useCallback } from 'react';
import { browserAPI } from '../utils/browserAPI.js';
import { RESTRICTED_URLS, NOTIFICATION_TYPES } from '../utils/constants.js';

export const useImageHandler = (onShowNotification) => {
  const [selectedImage, setSelectedImage] = useState(null);

  console.log('useImageHandler render:', { hasSelectedImage: !!selectedImage });

  // Handle file upload
  const handleFileUpload = useCallback((file) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target.result;
        if (!result || !result.startsWith('data:image/')) {
          console.error('Invalid image data from FileReader');
          onShowNotification('Invalid image file', NOTIFICATION_TYPES.ERROR);
          return;
        }
        
        const imageData = {
          data: result,
          type: file.type,
          name: file.name
        };
        console.log('File uploaded, setting image:', imageData.name);
        console.log('Image data length:', result.length);
        setSelectedImage(imageData);
        onShowNotification('Image uploaded!', NOTIFICATION_TYPES.SUCCESS);
      };
      reader.onerror = (error) => {
        console.error('FileReader error:', error);
        onShowNotification('Failed to read image file', NOTIFICATION_TYPES.ERROR);
      };
      reader.readAsDataURL(file);
    } else {
      onShowNotification('Please select a valid image file', NOTIFICATION_TYPES.ERROR);
    }
  }, [onShowNotification]);

  // Handle screen capture
  const handleScreenCapture = useCallback(async () => {
    console.log('Capture button clicked');
    
    try {
      const tabs = await browserAPI.tabs.query({active: true, currentWindow: true});
      console.log('Active tabs:', tabs);
      
      if (!tabs || tabs.length === 0) {
        throw new Error('No active tab found');
      }
      
      const tab = tabs[0];
      
      // Check if it's a restricted page
      const isRestricted = RESTRICTED_URLS.some(url => tab.url.startsWith(url));
      if (isRestricted) {
        throw new Error('Cannot capture on this page. Please switch to a regular website.');
      }
      
      // Try to inject content script if it's not already there
      try {
        await browserAPI.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        console.log('Content script injected');
      } catch (injectError) {
        console.log('Content script may already be injected:', injectError.message);
      }
      
      try {
        await browserAPI.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ['capture-overlay.css']
        });
        console.log('CSS injected');
      } catch (cssError) {
        console.log('CSS may already be injected:', cssError.message);
      }
      
      // Wait a bit for injection
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const response = await browserAPI.tabs.sendMessage(tab.id, {action: 'startCapture'});
      console.log('Capture start response:', response);
      
      onShowNotification('Click and drag on the page to capture!', NOTIFICATION_TYPES.INFO);
      
    } catch (error) {
      console.error('Capture error:', error);
      onShowNotification(error.message || 'Failed to start capture. Try refreshing the page.', NOTIFICATION_TYPES.ERROR);
    }
  }, [onShowNotification]);

  const removeImage = useCallback(() => {
    console.log('Removing image');
    setSelectedImage(null);
    onShowNotification('Image removed', NOTIFICATION_TYPES.INFO);
  }, [onShowNotification]);

  const clearImage = useCallback(() => {
    console.log('Clearing image');
    setSelectedImage(null);
  }, []);

  return {
    selectedImage,
    setSelectedImage,
    handleFileUpload,
    handleScreenCapture,
    removeImage,
    clearImage
  };
};
