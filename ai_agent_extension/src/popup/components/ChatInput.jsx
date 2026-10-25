import React, { useState, useRef, useEffect } from 'react';
import ImagePreview from './ImagePreview.jsx';
import { TEXTAREA_MAX_HEIGHT } from '../utils/constants.js';

const ChatInput = ({ 
  selectedImage, 
  onImageRemove, 
  onSendMessage, 
  onFileUpload,
  onScreenCapture,
  disabled = false 
}) => {
  const [message, setMessage] = useState('');
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  console.log('ChatInput render:', { hasSelectedImage: !!selectedImage, selectedImageName: selectedImage?.name });

  // Auto-resize functionality
  const handleTextareaChange = (e) => {
    setMessage(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, TEXTAREA_MAX_HEIGHT) + 'px';
  };

  // Enter key handling
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Send validation logic
  const handleSend = async () => {
    if (!message.trim() && !selectedImage) {
      return;
    }

    const messageToSend = message.trim();
    
    // Clear message immediately for smooth UX (like image clearing)
    setMessage('');
    
    // Reset height immediately
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    await onSendMessage(messageToSend, selectedImage);
  };

  // Focus management
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  const handleFileInputChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      onFileUpload(file);
      // Clear the input so the same file can be selected again
      e.target.value = '';
    }
  };

  return (
    <div className="chat-input">
      {/* Image preview functionality - ensure it's always visible when present */}
      {selectedImage && (
        <div style={{ 
          marginBottom: '10px',
          border: '2px solid #007bff', // Debug border to make it visible
          padding: '5px'
        }}>
          <ImagePreview selectedImage={selectedImage} onRemove={onImageRemove} />
        </div>
      )}

      <div className="input-container">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={handleTextareaChange}
          onKeyPress={handleKeyPress}
          placeholder="Take a snippet or type your message..."
          rows="1"
          className="message-input"
        />
        
        <div className="input-buttons">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="upload-button" 
            title="Upload image"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
              <path d="M12,13L16,17H8L12,13Z"/>
            </svg>
          </button>
          
          <button 
            onClick={onScreenCapture}
            className="capture-button"
            title="Capture screen area"
          >
            📷 Take Snippet
          </button>
          
          <button 
            onClick={handleSend} 
            className="send-button"
            disabled={disabled}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </div>
      </div>

      <input 
        ref={fileInputRef}
        type="file" 
        accept="image/*" 
        className="hidden"
        onChange={handleFileInputChange}
      />
    </div>
  );
};

export default ChatInput;
