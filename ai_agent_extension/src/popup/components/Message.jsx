import React from 'react';
import { parseMarkdown } from '../utils/markdown.js';
import { IMAGE_MAX_WIDTH } from '../utils/constants.js';

const Message = ({ message }) => {
  const { content, role, image, isError, isStreaming, isToolMessage } = message;
  
  // console.log('Message component render:', { role, hasImage: !!image, imageType: typeof image });
  // if (image) {
  //   console.log('Image data structure:', { 
  //     hasData: !!image.data, 
  //     dataLength: image.data?.length || 0,
  //     dataPreview: image.data?.substring(0, 50) + '...'
  //   });
  // }

  const messageStyle = isError ? {
    color: '#ef4444',
    borderColor: '#fecaca',
    background: '#fef2f2'
  } : {};

  // Special styling for tool messages
  const toolMessageStyle = isToolMessage ? {
    backgroundColor: '#f3f4f6',
    border: '1px solid #e5e7eb',
    borderRadius: '0.5rem',
    padding: '0.5rem',
    margin: '0.25rem 0',
    fontSize: '0.875rem',
    color: '#6b7280'
  } : {};

  return (
    <div className={`message ${role} ${isStreaming ? 'streaming' : ''} ${isToolMessage ? 'tool-message' : ''}`}>
      {/* Only show avatar for non-tool messages or the first tool message in a sequence */}
      {!isToolMessage && (
        <div className={`avatar ${role}`}>
          {role === 'user' ? '👤' : '🛒'}
        </div>
      )}
      <div className="message-content" style={{...messageStyle, ...toolMessageStyle}}>
        {/* Add image if present for user messages or assistant screenshot previews */}
        {image && (role === 'user' || (role === 'assistant' && content.includes('📸 Screenshot captured'))) && (
          <img 
            className="message-image"
            src={image.data}
            alt={role === 'user' ? 'Uploaded content' : 'Screenshot preview'}
            style={{
              maxWidth: IMAGE_MAX_WIDTH,
              borderRadius: '0.5rem',
              marginBottom: '0.5rem',
              display: 'block',
              border: role === 'assistant' ? '2px solid #e5e7eb' : 'none'
            }}
          />
        )}
        
        {/* Add text if present */}
        {content && (
          <div className="message-text">
            {role === 'bot' && !isError && !isToolMessage ? (
              <div dangerouslySetInnerHTML={{ __html: parseMarkdown(content) }} />
            ) : (
              <div>{content}</div>
            )}
            {isStreaming && role === 'assistant' && (
              <span className="streaming-cursor">▋</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Message;
