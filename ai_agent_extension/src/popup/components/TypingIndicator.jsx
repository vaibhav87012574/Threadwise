import React from 'react';

const TypingIndicator = ({ streamingContent }) => {
  return (
    <div className="typing-indicator">
      <div className="avatar bot">🛒</div>
      <div className="message-content">
        {streamingContent ? (
          <div className="streaming-content">
            {streamingContent}
            <span className="cursor">▋</span>
          </div>
        ) : (
          <div className="typing-dots">
            <div className="typing-dot"></div>
            <div className="typing-dot"></div>
            <div className="typing-dot"></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TypingIndicator;
