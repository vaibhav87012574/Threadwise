import { useState, useCallback, useEffect, useRef } from 'react';
import { browserAPI } from '../utils/browserAPI.js';
import { API_BASE_URL } from '../utils/constants.js';
import { useWebSocket } from './useWebSocket.js';

export const useChatWithWebSocket = () => {
  const [messages, setMessages] = useState([]);
  const [currentThreadId, setCurrentThreadId] = useState(1);
  const [isTyping, setIsTyping] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [useWebSocketMode, setUseWebSocketMode] = useState(true);

  const {
    isConnected,
    connectionError,
    sendStreamMessage,
    sendSocketMessage,
    addEventListener,
    removeEventListener
  } = useWebSocket();

  // Clean up on component mount to prevent persistent state issues
  useEffect(() => {
    console.log('🚀 Initializing chat hook...');
    // Clear any persistent error states or incomplete tool calls on mount
    setMessages(prevMessages => 
      prevMessages.filter(msg => !msg.isStreaming && !msg.isError)
    );
    setStreamingContent('');
    setIsTyping(false);
    
    // Initialize refs if they're not already set
    if (!processedMessagesRef.current) {
      processedMessagesRef.current = new Set();
    }
    if (!processedToolCallsRef.current) {
      processedToolCallsRef.current = new Set();
    }
    
    console.log('✅ Chat hook initialized');
  }, []); // Run once on mount

  // Handle WebSocket events - use refs to persist data across renders
  const processedMessagesRef = useRef(new Set());
  const processedToolCallsRef = useRef(new Set());
  
  // Store current values in refs so they're accessible in event handlers
  const currentThreadIdRef = useRef(currentThreadId);
  const setMessagesRef = useRef(setMessages);
  const setIsTypingRef = useRef(setIsTyping);
  const setStreamingContentRef = useRef(setStreamingContent);
  const sendSocketMessageRef = useRef(sendSocketMessage);
  
  // Update refs when values change
  useEffect(() => {
    currentThreadIdRef.current = currentThreadId;
    setMessagesRef.current = setMessages;
    setIsTypingRef.current = setIsTyping;
    setStreamingContentRef.current = setStreamingContent;
    sendSocketMessageRef.current = sendSocketMessage;
  });

  useEffect(() => {
    if (!isConnected) return;

    // Use refs for persistent tracking
    const processedMessages = processedMessagesRef.current;
    const processedToolCalls = processedToolCallsRef.current;

    const handleStreamStart = (data) => {
      console.log('Stream started:', data);
      setIsTypingRef.current(true);
      setStreamingContentRef.current('');
      
      // Clear any error or streaming messages from previous sessions
      setMessagesRef.current(prev => prev.filter(msg => 
        !msg.isStreaming && 
        !msg.isError &&
        msg.role !== 'system'  // Keep non-streaming, non-error messages
      ));
      
      // Reset tracking for new stream - be more aggressive
      processedToolCalls.clear();
      processedMessages.clear(); // Also clear processed messages for fresh start
    };

    const handleStreamUpdate = (data) => {
      console.log('🎯 Stream update received:', data);
      
      // Create more specific unique key that includes timestamp for better deduplication
      const messageKey = `${data.type}_${data.node}_${data.content}_${data.thread_id}`;
      
      // Use a safer hash method that can handle Unicode characters
      const createSafeHash = (str) => {
        if (!str) return '';
        try {
          // Convert to base64 safely by first encoding as UTF-8
          return btoa(unescape(encodeURIComponent(str))).substring(0, 8);
        } catch (e) {
          // Fallback: use simple string hash if btoa fails
          let hash = 0;
          for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
          }
          return Math.abs(hash).toString(36).substring(0, 8);
        }
      };
      
      const contentHash = createSafeHash(data.content || '');
      const specificKey = `${data.type}_${data.node}_${contentHash}_${data.thread_id}`;
      
      // For browser tool messages, use a less restrictive deduplication to ensure they show up
      const isBrowserToolMessage = data.content && (
        data.content.includes('🔧') || 
        data.content.includes('✅') || 
        data.content.includes('❌') ||
        data.content.includes('Browser action') ||
        data.type === 'tool_result' ||  // Backend sends tool results with this type
        data.type === 'tool_call' ||    // Backend sends tool calls with this type
        (data.node === 'browser_tools') // Backend sends from browser_tools node
      );
      
      // Enhanced duplicate detection - use exact content match for tool messages
      const isDuplicate = isBrowserToolMessage ? 
        processedMessages.has(data.content) : // Exact content match for tool messages
        processedMessages.has(specificKey);    // Hash-based for regular messages
      
      if (isDuplicate) {
        console.log('🚫 Duplicate message detected, skipping:', data.content.substring(0, 50));
        return; // Skip duplicate messages completely
      }
      
      // Add to processed messages
      if (isBrowserToolMessage) {
        processedMessages.add(data.content); // Store exact content for tool messages
        console.log('🔧 Processing tool message:', data.content);
      } else {
        processedMessages.add(specificKey);
        console.log('💬 Processing regular message:', data.content.substring(0, 50));
      }
      
      if (data.type === 'message') {
        // For message type updates, check if we already have this content
        setMessagesRef.current(prev => {
          // Check if we already have a message with this exact content from assistant
          const existingMessage = prev.find(msg => 
            msg.role === 'assistant' && 
            msg.content === data.content && 
            Math.abs(msg.timestamp - Date.now()) < 10000 // Within last 10 seconds
          );
          
          if (existingMessage) {
            console.log('📝 Similar message already exists, skipping');
            return prev;
          }
          
          // Add new message
          const aiMessage = {
            content: data.content,
            role: 'assistant',
            image: null,
            isStreaming: true,
            node: data.node,
            timestamp: Date.now(),
            messageKey: specificKey
          };
          
          console.log('➕ Adding new message:', data.content.substring(0, 50));
          return [...prev, aiMessage];
        });
        
        // Clear streaming content since we're showing the message directly
        setStreamingContentRef.current('');
      } else if (data.type === 'tool_call' || data.type === 'tool_result') {
        // For tool calls and results, show as permanent messages (not just streaming content)
        console.log('🛠️ Tool status message received:', data.content);
        
        setMessagesRef.current(prev => {
          // For tool messages, check if we should update an existing tool message or create a new one
          const lastMessage = prev[prev.length - 1];
          
          // If the last message is a tool message from the same thread and this is a completion, group them
          if (lastMessage && 
              lastMessage.isToolMessage && 
              lastMessage.role === 'assistant' &&
              data.content.includes('✅') && 
              lastMessage.content.includes('🔧')) {
            // This is a completion message, update the last tool message
            console.log('🔄 Updating existing tool message with completion');
            return prev.map((msg, index) => 
              index === prev.length - 1 ? 
                { ...msg, content: `${msg.content}\n${data.content}`, timestamp: Date.now() } : 
                msg
            );
          }
          
          // For tool messages, use exact content matching to prevent any duplicates
          const existingToolMessage = prev.find(msg => 
            msg.role === 'assistant' && 
            msg.content === data.content // Exact content match
          );
          
          if (existingToolMessage) {
            console.log('🚫 Tool message already exists, skipping');
            return prev;
          }
          
          // Add tool status message as permanent message
          const toolMessage = {
            content: data.content,
            role: 'assistant',
            image: null,
            isStreaming: false, // Tool messages are immediate and final
            node: data.node,
            timestamp: Date.now(),
            messageKey: specificKey,
            isToolMessage: true // Mark as tool message for styling
          };
          
          console.log('🔧 Adding new tool message:', data.content);
          return [...prev, toolMessage];
        });
      } else {
        // For other updates, check if it's a browser tool execution message
        const isBrowserToolMessage = data.content && (
          data.content.includes('🔧') || 
          data.content.includes('✅') || 
          data.content.includes('❌') ||
          data.content.includes('Browser action') ||
          data.type === 'tool_result' ||  // Backend sends tool results with this type
          (data.node === 'browser_tools') // Backend sends from browser_tools node
        );
        
        if (isBrowserToolMessage) {
          // Show browser tool messages as permanent messages
          console.log('🎯 Browser tool execution message received:', data.content);
          
          setMessagesRef.current(prev => {
            // Check if we already have this exact message (stricter check)
            const existingMessage = prev.find(msg => 
              msg.role === 'assistant' && 
              msg.content === data.content && // Exact content match
              msg.isToolMessage === true
            );
            
            if (existingMessage) {
              console.log('🚫 Browser tool message already exists, skipping');
              return prev;
            }
            
            // Add browser tool message as permanent message
            const toolMessage = {
              content: data.content,
              role: 'assistant',
              image: null,
              isStreaming: false,
              node: data.node,
              timestamp: Date.now(),
              messageKey: specificKey,
              isToolMessage: true
            };
            
            console.log('🎯 Adding browser tool message:', data.content);
            return [...prev, toolMessage];
          });
        } else {
          // For regular streaming updates, just update streaming content
          console.log('📄 Updating streaming content:', data.content.substring(0, 50));
          setStreamingContentRef.current(data.content);
        }
      }
    };

    const handleBrowserToolCall = async (data) => {
      console.log('🔧 Browser tool call received:', data);
      
      try {
        const { tool_name, tool_args, tool_id, thread_id } = data;
        
        // Prevent duplicate tool calls using a more robust check
        const toolCallKey = `${tool_id}_${tool_name}_${thread_id}`;
        if (processedToolCalls.has(toolCallKey)) {
          console.log('Duplicate tool call detected, skipping:', toolCallKey);
          return;
        }
        processedToolCalls.add(toolCallKey);
        
        // Don't add a frontend message here - the backend will send the execution message
        // Just track that we're processing this tool call and execute it
        console.log(`Processing browser tool call: ${tool_name} (${tool_id})`);
        
        // Execute the browser action using background.js
        let result;
        let screenshot = null;
        
        try {
          switch (tool_name) {
            case 'add_to_cart':
              result = await browserAPI.runtime.sendMessage({
                action: 'sendToAPI',
                content: `add_to_cart:("${tool_args.product_name}")`,
                thread_id: currentThreadIdRef.current
              });
              break;
              
            case 'scroll_page':
              result = await browserAPI.runtime.sendMessage({
                action: 'sendToAPI',
                content: `scroll${tool_args.direction}:${tool_args.amount}`,
                thread_id: currentThreadIdRef.current
              });
              break;
              
            case 'set_price_range':
              const priceData = JSON.stringify({ lower: tool_args.min_price, higher: tool_args.max_price });
              result = await browserAPI.runtime.sendMessage({
                action: 'sendToAPI',
                content: `price:${priceData}`,
                thread_id: currentThreadIdRef.current
              });
              break;
              
            case 'search_page':
              result = await browserAPI.runtime.sendMessage({
                action: 'sendToAPI',
                content: `search:${tool_args.query}`,
                thread_id: currentThreadIdRef.current
              });
              break;
              
            case 'click_element':
              result = await browserAPI.runtime.sendMessage({
                action: 'sendToAPI',
                content: `click on ${tool_args.target}`,
                thread_id: currentThreadIdRef.current
              });
              break;
              
            case 'screen_capture':
              // For screen capture, automatically capture the full page
              console.log('🔧 Executing screen_capture tool call - capturing current tab...');
              result = await browserAPI.runtime.sendMessage({
                action: 'captureFullPage'
              });
              
              console.log('📸 captureFullPage result:', result);
              
              // If capture was successful, extract the screenshot immediately
              if (result && result.success && result.imageData && result.imageData.data) {
                const base64Data = result.imageData.data.split(',')[1];
                screenshot = base64Data;
                console.log('✅ Screen capture successful, image size:', base64Data.length, 'bytes');
                
                // Add a preview message to the chat showing what was captured
                const screenshotPreviewMessage = {
                  content: '📸 Screenshot captured and sent to AI model for analysis',
                  role: 'assistant',
                  image: {
                    data: result.imageData.data, // Full data URL with mime type
                    type: 'image/png',
                    name: 'screen-capture.png'
                  },
                  isStreaming: false,
                  timestamp: Date.now(),
                  messageKey: `screenshot_preview_${Date.now()}`,
                  isToolMessage: false
                };
                
                console.log('Adding screenshot preview to chat');
                setMessagesRef.current(prev => [...prev, screenshotPreviewMessage]);
                
                // Send the result immediately to backend wrapped in ToolMessage
                const resultMessage = {
                  thread_id: thread_id,
                  tool_id: tool_id,
                  tool_name: tool_name,
                  success: true,
                  screenshot_data: screenshot, // Base64 data without data: prefix
                  error: null
                };
                
                console.log('📤 Sending screen_capture result to backend for ToolMessage wrapping');
                sendSocketMessageRef.current('browser_tool_result', resultMessage);
                console.log('✅ Screen capture tool completed successfully');
                return; // Exit early for screen_capture to avoid the setTimeout logic
              } else {
                console.error('❌ Failed to capture screenshot:', result);
                
                // Add a failure message to the chat
                const failureMessage = {
                  content: '❌ Screenshot capture failed - unable to capture current tab',
                  role: 'assistant',
                  image: null,
                  isStreaming: false,
                  timestamp: Date.now(),
                  messageKey: `screenshot_failure_${Date.now()}`,
                  isToolMessage: true
                };
                
                console.log('Adding screenshot failure message to chat');
                setMessagesRef.current(prev => [...prev, failureMessage]);
                
                // Send failure result immediately
                const failureResult = {
                  thread_id: thread_id,
                  tool_id: tool_id,
                  tool_name: tool_name,
                  success: false,
                  screenshot_data: null,
                  error: result?.error || 'Failed to capture screenshot'
                };
                
                console.log('📤 Sending screen_capture failure result to backend');
                sendSocketMessageRef.current('browser_tool_result', failureResult);
                console.log('❌ Screen capture tool failed');
                return; // Exit early for screen_capture
              }
              break;
              
            case 'checkout':
              result = await browserAPI.runtime.sendMessage({
                action: 'sendToAPI',
                content: 'checkout_cart',
                thread_id: currentThreadIdRef.current
              });
              break;
              
            case 'navigate_to_cart':
              result = await browserAPI.runtime.sendMessage({
                action: 'sendToAPI',
                content: 'goto_cart',
                thread_id: currentThreadIdRef.current
              });
              break;
              
            default:
              throw new Error(`Unknown tool: ${tool_name}`);
          }
          
          // Wait a bit for the action to complete, then take screenshot (except for screen_capture which already handles its result)
          setTimeout(async () => {
            try {
              // For screen_capture tool, we already handled the result above, so skip this entire block
              if (tool_name === 'screen_capture') {
                return;
              }
              
              // Take screenshot after action for other tools
              const screenshotResult = await browserAPI.runtime.sendMessage({
                action: 'captureScreen',
                captureData: {
                  left: 0,
                  top: 0,
                  width: window.innerWidth,
                  height: window.innerHeight,
                  devicePixelRatio: window.devicePixelRatio || 1
                }
              });
              
              if (screenshotResult && screenshotResult.success && screenshotResult.imageData) {
                // Extract base64 data from data URL
                const base64Data = screenshotResult.imageData.data.split(',')[1];
                screenshot = base64Data;
              }
            } catch (screenshotError) {
              console.error('Screenshot capture failed:', screenshotError);
            }
            
            // Send result back to backend - always report success unless there was a clear error
            let toolSuccess = false;
            let errorMessage = null;
            
            // Check the result object for non-screen_capture tools
            toolSuccess = result && result.success && !result.error;
            errorMessage = toolSuccess ? null : (result?.error || 'Browser action completed but may not have been fully successful');
            
            const resultMessage = {
              thread_id: thread_id,
              tool_id: tool_id,
              tool_name: tool_name,
              success: toolSuccess,
              screenshot_data: screenshot,
              error: errorMessage
            };
            
            console.log('Sending browser tool result:', resultMessage);
            sendSocketMessageRef.current('browser_tool_result', resultMessage);
            
            // Don't update tool message here - backend handles the UI updates
            console.log(`Tool ${tool_name} completed ${toolSuccess ? 'successfully' : 'with issues'}`);
          }, 1000); // Wait 1 second for action to complete
          
        } catch (actionError) {
          console.error('Browser action execution failed:', actionError);
          
          // Send error result back to backend
          const errorResult = {
            thread_id: data.thread_id,
            tool_id: data.tool_id,
            tool_name: data.tool_name,
            success: false,
            screenshot_data: null,
            error: actionError.message
          };
          
          console.log('Sending browser tool error result:', errorResult);
          sendSocketMessageRef.current('browser_tool_result', errorResult);
          
          // Don't update tool message here - backend handles the error UI updates
          console.log(`Tool ${data.tool_name} failed: ${actionError.message}`);
        }
        
      } catch (error) {
        console.error('Browser tool handling failed:', error);
        
        // Send error result back to backend
        const errorResult = {
          thread_id: data.thread_id,
          tool_id: data.tool_id,
          tool_name: data.tool_name,
          success: false,
          screenshot_data: null,
          error: error.message
        };
        
        console.log('Sending browser tool handling error result:', errorResult);
        sendSocketMessageRef.current('browser_tool_result', errorResult);
        
        // Don't update tool message here - backend handles the error UI updates
        console.log(`Tool ${data.tool_name} handling failed: ${error.message}`);
      }
    };

    const handleStreamComplete = (data) => {
      console.log('Stream complete:', data);
      setIsTypingRef.current(false);
      setStreamingContentRef.current('');
      
      // Update any streaming messages to be final
      setMessagesRef.current(prev => {
        return prev.map(msg => {
          if (msg.isStreaming) {
            return { ...msg, isStreaming: false };
          }
          return msg;
        });
      });
      
      // Don't add a separate final message since we already have the streaming messages
      // The final content is usually the same as the last streaming message
    };

    const handleError = (data) => {
      console.error('WebSocket error:', data);
      setIsTypingRef.current(false);
      setStreamingContentRef.current('');
      
      // Add error message to chat
      const errorMessage = {
        content: `Error: ${data.message}`,
        role: 'assistant',
        image: null,
        isError: true
      };
      setMessagesRef.current(prev => [...prev, errorMessage]);
    };

    // Add event listeners
    addEventListener('stream_start', handleStreamStart);
    addEventListener('stream_update', handleStreamUpdate);
    addEventListener('browser_tool_call', handleBrowserToolCall);
    addEventListener('stream_complete', handleStreamComplete);
    addEventListener('error', handleError);

    // Cleanup
    return () => {
      removeEventListener('stream_start', handleStreamStart);
      removeEventListener('stream_update', handleStreamUpdate);
      removeEventListener('browser_tool_call', handleBrowserToolCall);
      removeEventListener('stream_complete', handleStreamComplete);
      removeEventListener('error', handleError);
    };
  }, [isConnected, addEventListener, removeEventListener]); // Remove dependencies that cause frequent re-renders

  // Load chat history from API (same as original)
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

      if (data.messages && data.messages.length > 0) {
        const formattedMessages = data.messages.map(msg => {
          let imageData = null;
          if (msg.image) {
            imageData = {
              name: 'Chat Image',
              data: msg.image,
              type: 'image/jpeg'
            };
          }

          return {
            content: msg.content,
            role: msg.role,
            image: imageData
          };
        });

        setMessages(formattedMessages);
        return true;
      } else {
        setMessages([]);
        return false;
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
      return false;
    }
  }, [currentThreadId]);

  // Send message with WebSocket streaming or fallback to HTTP
  const sendMessage = useCallback(async (content, image = null) => {
    // Add user message immediately
    const userMessage = { content, role: 'user', image };
    setMessages(prev => [...prev, userMessage]);

    // Prepare image data for WebSocket
    let imageData = null;
    if (image && image.data) {
      imageData = image.data.split(',')[1]; // Remove data:image/jpeg;base64, prefix
    }

    // Try WebSocket first if connected and enabled
    if (useWebSocketMode && isConnected) {
      console.log('Sending via WebSocket...');
      const success = sendStreamMessage(content, currentThreadId, imageData);
      
      if (success) {
        return { success: true };
      } else {
        console.warn('WebSocket send failed, falling back to HTTP');
      }
    }

    // Fallback to original HTTP method
    console.log('Sending via HTTP API...');
    setIsTypingRef.current(true);

    try {
      const requestData = {
        action: 'sendToAPI',
        content,
        thread_id: currentThreadId
      };

      if (image) {
        requestData.image = image;
      }

      const response = await browserAPI.runtime.sendMessage(requestData);
      console.log('HTTP Response received:', response);

      if (response && response.success) {
        if (response.reply) {
          const aiMessage = {
            content: response.reply,
            role: 'assistant',
            image: null
          };
          setMessagesRef.current(prev => [...prev, aiMessage]);
        }
        return { success: true };
      } else {
        return { success: false, error: response?.error || 'Unknown error' };
      }
    } catch (error) {
      console.error('Send message error:', error);
      return { success: false, error: error.message };
    } finally {
      setIsTypingRef.current(false);
    }
  }, [currentThreadId, useWebSocketMode, isConnected, sendStreamMessage]);

  // Start new chat
  const startNewChat = useCallback(async () => {
    const newThreadId = Math.floor(Math.random() * 1000000);
    setCurrentThreadId(newThreadId);
    
    // Thoroughly clear all state
    setMessages([]);
    setStreamingContent('');
    setIsTyping(false);
    
    // Clear tracking to prevent stale state
    processedMessagesRef.current.clear();
    processedToolCallsRef.current.clear();
    
    console.log('Started new chat with thread ID:', newThreadId);
    console.log('Cleared all previous state including streaming messages and errors');
    
    return 'New chat started!';
  }, []);

  // Toggle WebSocket mode
  const toggleWebSocketMode = useCallback(() => {
    setUseWebSocketMode(prev => !prev);
  }, []);

  return {
    messages,
    currentThreadId,
    isTyping,
    streamingContent,
    useWebSocketMode,
    isWebSocketConnected: isConnected,
    webSocketError: connectionError,
    sendMessage,
    startNewChat,
    loadChatHistory,
    toggleWebSocketMode
  };
};
