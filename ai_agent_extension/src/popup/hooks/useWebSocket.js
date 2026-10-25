import { useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { API_BASE_URL } from '../utils/constants.js';

export const useWebSocket = () => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const socketRef = useRef(null);
  const eventListenersRef = useRef(new Map());

  // Initialize socket connection
  const connect = useCallback(() => {
    if (socketRef.current?.connected) {
      console.log('WebSocket already connected');
      return;
    }

    try {
      console.log('Connecting to WebSocket server...');
      const newSocket = io(API_BASE_URL, {
        autoConnect: true,
        timeout: 5000,
        transports: ['polling', 'websocket'] // Fallback to polling if websocket fails
      });

      newSocket.on('connect', () => {
        console.log('WebSocket connected successfully');
        setIsConnected(true);
        setConnectionError(null);
      });

      newSocket.on('disconnect', (reason) => {
        console.log('WebSocket disconnected:', reason);
        setIsConnected(false);
      });

      newSocket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
        setConnectionError(error.message);
        setIsConnected(false);
      });

      socketRef.current = newSocket;
      setSocket(newSocket);
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionError(error.message);
    }
  }, []);

  // Disconnect socket
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      console.log('Disconnecting WebSocket...');
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
    }
  }, []);

  // Send message via WebSocket
  const sendStreamMessage = useCallback((message, threadId, imageData = null) => {
    if (!socketRef.current?.connected) {
      console.error('WebSocket not connected');
      return false;
    }

    const data = {
      message,
      thread_id: threadId,
      image_data: imageData
    };

    console.log('Sending WebSocket message:', data);
    socketRef.current.emit('chat_stream', data);
    return true;
  }, []);

  // Send any message to the server
  const sendSocketMessage = useCallback((eventName, data) => {
    if (!socketRef.current?.connected) {
      console.warn('WebSocket not connected, cannot send message');
      return false;
    }

    console.log(`Sending WebSocket event '${eventName}':`, data);
    socketRef.current.emit(eventName, data);
    return true;
  }, []);

  // Add event listener
  const addEventListener = useCallback((eventName, callback) => {
    if (socketRef.current) {
      socketRef.current.on(eventName, callback);
      
      // Track listeners for cleanup
      if (!eventListenersRef.current.has(eventName)) {
        eventListenersRef.current.set(eventName, []);
      }
      eventListenersRef.current.get(eventName).push(callback);
    }
  }, []);

  // Remove event listener
  const removeEventListener = useCallback((eventName, callback) => {
    if (socketRef.current) {
      socketRef.current.off(eventName, callback);
      
      // Remove from tracking
      const listeners = eventListenersRef.current.get(eventName);
      if (listeners) {
        const index = listeners.indexOf(callback);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    }
  }, []);

  // Remove all event listeners for an event
  const removeAllEventListeners = useCallback((eventName) => {
    if (socketRef.current) {
      socketRef.current.removeAllListeners(eventName);
      eventListenersRef.current.delete(eventName);
    }
  }, []);

  // Initialize connection on mount
  useEffect(() => {
    connect();

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        // Remove all tracked listeners
        eventListenersRef.current.forEach((listeners, eventName) => {
          listeners.forEach(callback => {
            socketRef.current.off(eventName, callback);
          });
        });
        eventListenersRef.current.clear();
        
        socketRef.current.disconnect();
      }
    };
  }, [connect]);

  return {
    socket,
    isConnected,
    connectionError,
    connect,
    disconnect,
    sendStreamMessage,
    sendSocketMessage,
    addEventListener,
    removeEventListener,
    removeAllEventListeners
  };
};
