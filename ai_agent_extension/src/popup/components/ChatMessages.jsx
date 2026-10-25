import { useRef, useEffect } from 'react';
import Message from './Message.jsx';
import EmptyState from './EmptyState.jsx';
import TypingIndicator from './TypingIndicator.jsx';

const ChatMessages = ({ messages, isTyping, streamingContent, isEmpty }) => {
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, streamingContent]);

  return (
    <div className="chat-messages">
      {isEmpty && <EmptyState />}
      
      {messages.map((message, index) => (
        <Message key={`${index}-${message.timestamp || index}`} message={message} />
      ))}
      
      {/* Only show typing indicator if we're typing but don't have streaming content displayed as messages */}
      {isTyping && streamingContent && (
        <div className="typing-indicator">
          <div className="avatar bot">🛒</div>
          <div className="message-content">
            <div className="streaming-content">
              {streamingContent}
              <span className="cursor">▋</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Show simple typing indicator if typing but no streaming content */}
      {isTyping && !streamingContent && <TypingIndicator />}
      
      <div ref={messagesEndRef} />
    </div>
  );
};

export default ChatMessages;
