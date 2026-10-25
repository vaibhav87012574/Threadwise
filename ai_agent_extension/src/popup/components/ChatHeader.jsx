import React from 'react';

const ChatHeader = ({ onNewChat, isWebSocketConnected, webSocketError }) => {
  return (
    <div className="chat-header">
      <div className="avatar bot">🛒</div>
      <div className="header-content">
        <h1>Threadwise</h1>
        <div className="header-status">
          <p>Find products, get recommendations & shop smarter!</p>
          <div className={`connection-status ${isWebSocketConnected ? 'connected' : 'disconnected'}`}>
            <span className="status-dot"></span>
            <span className="status-text">
              {isWebSocketConnected ? 'Real-time mode' : webSocketError ? 'Offline mode' : 'Connecting...'}
            </span>
          </div>
        </div>
      </div>
      <button 
        className="new-chat-button" 
        title="Start new shopping session"
        onClick={onNewChat}
      >
        +
      </button>
    </div>
  );
};

export default ChatHeader;
