import React, { useEffect, useState } from 'react';
import '../../styles.css';
import ChatHeader from './components/ChatHeader.jsx';
import ChatMessages from './components/ChatMessages.jsx';
import ChatInput from './components/ChatInput.jsx';
import Notification from './components/Notification.jsx';
import { useChatWithWebSocket } from './hooks/useChatWithWebSocket.js';
import { useNotifications } from './hooks/useNotifications.js';
import { useImageHandler } from './hooks/useImageHandler.js';
import { useBackgroundMessages } from './hooks/useBackgroundMessages.js';

const App = () => {
  const { 
    messages, 
    currentThreadId, 
    isTyping, 
    streamingContent,
    useWebSocketMode,
    isWebSocketConnected,
    webSocketError,
    sendMessage, 
    startNewChat, 
    loadChatHistory,
    toggleWebSocketMode
  } = useChatWithWebSocket();

  const { notification, showNotification, hideNotification } = useNotifications();
  
  const { 
    selectedImage, 
    setSelectedImage, 
    handleFileUpload, 
    handleScreenCapture, 
    removeImage,
    clearImage 
  } = useImageHandler(showNotification);

  const [sendButtonDisabled, setSendButtonDisabled] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);

  // Handle captured images from background script
  const handleImageCaptured = (imageData) => {
    console.log('App: Handling captured image:', imageData.name);
    setSelectedImage(imageData);
  };

  // Listen for background messages
  useBackgroundMessages(handleImageCaptured, showNotification);

  // Load chat history on startup
  useEffect(() => {
    console.log('Chat popup loaded');
    loadChatHistory().then((hasMessages) => {
      setIsEmpty(!hasMessages);
    });
  }, [loadChatHistory]);

  // Update empty state when messages change
  useEffect(() => {
    setIsEmpty(messages.length === 0);
  }, [messages]);

  // Handle new chat
  const handleNewChat = async () => {
    // Clear any existing images before starting new chat
    console.log('App: Starting new chat, clearing any existing images');
    clearImage();
    
    const message = await startNewChat();
    showNotification(message, 'success');
    setIsEmpty(true);
  };

  // Handle send message
  const handleSendMessage = async (content, image) => {
    if (!content && !image) {
      showNotification('Please enter a message or select an image', 'error');
      return;
    }

    // Clear image immediately when user sends message for smooth UX
    clearImage();
    
    setSendButtonDisabled(true);
    
    try {
      const result = await sendMessage(content, image);
      if (!result.success) {
        showNotification(result.error || 'Failed to send message', 'error');
      }
    } catch (error) {
      console.error('Send message error:', error);
      showNotification('Failed to send message', 'error');
    } finally {
      setSendButtonDisabled(false);
    }
  };

  return (
    <div className="chat-container">
      <ChatHeader 
        onNewChat={handleNewChat}
        isWebSocketConnected={isWebSocketConnected}
        webSocketError={webSocketError}
      />
      
      <ChatMessages 
        messages={messages}
        isTyping={isTyping}
        streamingContent={streamingContent}
        isEmpty={isEmpty}
      />
      
      <ChatInput
        selectedImage={selectedImage}
        onImageRemove={removeImage}
        onSendMessage={handleSendMessage}
        onFileUpload={handleFileUpload}
        onScreenCapture={handleScreenCapture}
        disabled={sendButtonDisabled}
      />

      <Notification 
        notification={notification}
        onClose={hideNotification}
      />
    </div>
  );
};

export default App;
