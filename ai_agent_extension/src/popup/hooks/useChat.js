import { useState, useCallback } from 'react';
import { browserAPI } from '../utils/browserAPI.js';
import { API_BASE_URL } from '../utils/constants.js';

export const useChat = () => {
  const [messages, setMessages] = useState([]);
  const [currentThreadId, setCurrentThreadId] = useState(1);
  const [isTyping, setIsTyping] = useState(false);

  // Load chat history from API
  const loadChatHistory = useCallback(async (threadId = null) => {
    const targetThreadId = threadId || currentThreadId;
    try {
      console.log('Loading chat history for thread:', targetThreadId);
      const response = await fetch(`${API_BASE_URL}/chat?thread_id=${targetThreadId}`, {
        method: 'GET'
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Chat history loaded:', data);
      console.log('Raw messages from backend:', data.messages);

      if (data.messages && data.messages.length > 0) {
        const formattedMessages = data.messages.map(msg => {
          // Format image data to match component expectations
          let imageData = null;
          if (msg.image) {
            imageData = {
              data: msg.image, // Backend returns "data:image/jpeg;base64,..." string directly
              type: 'image/jpeg', // Default type
              name: 'chat-history-image.jpg' // Default name for history images
            };
          }
          
          return {
            content: msg.content,
            role: msg.role === 'user' ? 'user' : 'bot',
            image: imageData
          };
        });
        
        console.log('Formatted messages with images:', formattedMessages);
        setMessages(formattedMessages);
        return true; // Has messages
      }
      return false; // Empty
    } catch (error) {
      console.error('Failed to load chat history:', error);
      return false;
    }
  }, [currentThreadId]);

  // Send message to API via background script
  const sendMessage = useCallback(async (content, image = null) => {
    // Add user message immediately
    const userMessage = { content, role: 'user', image };
    setMessages(prev => [...prev, userMessage]);
    
    setIsTyping(true);

    try {
      console.log('Sending to background script');
      
      const requestData = {
        action: 'sendToAPI',
        content,
        thread_id: currentThreadId
      };

      if (image) {
        requestData.image = image;
      }

      const response = await browserAPI.runtime.sendMessage(requestData);
      console.log('Response received:', response);

      if (response && response.success) {
        setMessages(prev => [...prev, { content: response.message, role: 'bot' }]);
        return { success: true };
      } else {
        const errorMsg = response ? response.error : 'Unknown error occurred';
        const errorMessage = { 
          content: `Sorry, I encountered an error: ${errorMsg}`, 
          role: 'bot', 
          isError: true 
        };
        setMessages(prev => [...prev, errorMessage]);
        return { success: false, error: errorMsg };
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = { 
        content: `Sorry, I encountered an error: ${error.message}`, 
        role: 'bot', 
        isError: true 
      };
      setMessages(prev => [...prev, errorMessage]);
      return { success: false, error: error.message };
    } finally {
      setIsTyping(false);
    }
  }, [currentThreadId]);

  // Start new chat thread
  const startNewChat = useCallback(async () => {
    const newThreadId = currentThreadId + 1;
    console.log('Starting new chat with thread ID:', newThreadId);
    
    // Update thread ID first
    setCurrentThreadId(newThreadId);
    
    // Clear messages immediately
    setMessages([]);
    
    // Load chat history for the new thread using the new thread ID
    await loadChatHistory(newThreadId);
    
    return `Started new chat (Thread ${newThreadId})`;
  }, [currentThreadId, loadChatHistory]);

  return {
    messages,
    currentThreadId,
    isTyping,
    sendMessage,
    startNewChat,
    loadChatHistory
  };
};
