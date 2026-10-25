import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import './App.css';
import Closet from './Closet';

function App() {
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const chatHistoryRef = useRef(null);
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [currentThreadId, setCurrentThreadId] = useState('1');
  const [chatThreads, setChatThreads] = useState([
    { id: '1', name: 'Shopping Session 1', createdAt: new Date().toISOString() }
  ]);
  const [theme, setTheme] = useState('light');
  const [sidebarToggled, setSidebarToggled] = useState(false);

  useEffect(() => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
  }, [chatHistory]);

  // Load chat history when thread changes
  useEffect(() => {
    const restoreChatHistory = async () => {
      try {
        const res = await fetch(`http://localhost:5000/chat?thread_id=${currentThreadId}`, {
          method: 'GET',
        });

        if (res.ok) {
          const data = await res.json();
          if (data.messages && data.messages.length > 0) {
            // Convert base64 images back to object URLs for display
            const restoredMessages = data.messages.map(msg => {
              if (msg.image && msg.image.startsWith('data:image')) {
                // Convert base64 to blob URL for consistent display
                const byteCharacters = atob(msg.image.split(',')[1]);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                  byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: 'image/jpeg' });
                const imageUrl = URL.createObjectURL(blob);
                
                return { ...msg, image: imageUrl };
              }
              return msg;
            });
            setChatHistory(restoredMessages);
          } else {
            setChatHistory([]);
          }
        }
      } catch (error) {
        console.error('Failed to restore chat history:', error);
        setChatHistory([]);
      }
    };

    restoreChatHistory();
  }, [currentThreadId]);

  const sendMessage = async () => {
    const trimmed = message.trim();
    if (!trimmed && !image || isLoading) return;

    // Store the image URL in chat history instead of just the name
    const imageUrl = image ? URL.createObjectURL(image) : null;
    const newMessage = { role: 'user', content: trimmed, image: imageUrl };
    setChatHistory(prev => [...prev, newMessage]);
    setMessage('');
    setIsLoading(true);

    try {
      const formData = new FormData();
      if (trimmed) {
        formData.append('message', trimmed);
      }
      if (image) {
        formData.append('image', image);
      }
      // Add thread_id to form data
      formData.append('thread_id', currentThreadId);

      const res = await fetch('http://localhost:5000/chat', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        let errorText = 'Network error';
        try {
          const errorData = await res.json();
          errorText = errorData.error || errorText;
        } catch {
          errorText = res.statusText || errorText;
        }
        throw new Error(errorText);
      }

      const data = await res.json();
      const replyContent = typeof data.reply === 'string' ? data.reply : 'No valid response.';
      setChatHistory(prev => [...prev, { role: 'assistant', content: replyContent }]);
    } catch (error) {
      setChatHistory(prev => [...prev, { role: 'assistant', content: `Error: ${error.message}` }]);
    } finally {
      setIsLoading(false);
      setImage(null);
      setImagePreview(null); // Clear preview after sending
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImage(file);
      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
    }
  };

  const handleRemoveImage = () => {
    setImage(null);
    setImagePreview(null);
  };

  const categories = [
    { id: 'fashion', name: 'Fashion', icon: '👚' },
    { id: 'electronics', name: 'Electronics', icon: '📱' },
    { id: 'home', name: 'Home Decor', icon: '🏠' },
    { id: 'beauty', name: 'Beauty', icon: '💄' },
    { id: 'sports', name: 'Sports', icon: '⚽' },
  ];

  const quickActions = [
    { text: "Find similar fashion items", icon: "👕" },
    { text: "Help me complete this outfit", icon: "✨" },
    { text: "Suggest home decor items", icon: "🏠" },
    { text: "Find gadget accessories", icon: "📱" }
  ];

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  const createNewChat = () => {
    // Generate new thread ID by incrementing the highest existing ID
    const existingIds = chatThreads.map(thread => parseInt(thread.id));
    const newThreadId = (Math.max(...existingIds) + 1).toString();
    
    // Create new chat thread
    const newThread = {
      id: newThreadId,
      name: `Shopping Session ${newThreadId}`,
      createdAt: new Date().toISOString()
    };
    
    // Add to threads list
    setChatThreads(prev => [...prev, newThread]);
    
    // Switch to new thread
    setCurrentThreadId(newThreadId);
    
    // Clear current chat history (will be loaded from backend in useEffect)
    setChatHistory([]);
  };

  const switchToThread = (threadId) => {
    setCurrentThreadId(threadId);
    // Chat history will be loaded automatically by useEffect
  };

  const formatThreadName = (thread) => {
    const date = new Date(thread.createdAt);
    return `${thread.name} - ${date.toLocaleDateString()}`;
  };

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-title">🧵 Threadwise</div>
          <div className="sidebar-subtitle">Shop your closet first</div>
        </div>
        
        <button className="new-chat-button" onClick={createNewChat}>
          ＋ New Styling Session
        </button>
        
        <Closet refreshKey={chatHistory.length} />

        <div className="chat-history">
          {chatThreads.map((thread) => (
            <div
              key={thread.id}
              className={`history-item ${currentThreadId === thread.id ? 'active' : ''}`}
              onClick={() => switchToThread(thread.id)}
            >
              {formatThreadName(thread)}
            </div>
          ))}
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="main-content">
        <header className="chat-header">
          <div className="chat-title">🧵 Threadwise</div>
          <div className="chat-subtitle">Session: {chatThreads.find(t => t.id === currentThreadId)?.name || 'Shopping Chat'}</div>
        </header>

        <div className="messages-container" ref={chatHistoryRef}>
          {chatHistory.length === 0 && !isLoading && (
            <div className="welcome-screen">
              <div className="welcome-icon">🧵</div>
              <h2 className="welcome-title">Welcome to Threadwise ✨</h2>
              <p className="welcome-subtitle">
                A stylist that remembers your closet and your budget.<br />
                Add what you own, show what you want, and see how many new outfits it unlocks.
              </p>
              <div className="feature-grid">
                <div className="feature-card">
                  <span className="feature-icon">🔍</span>
                  <div className="feature-title">Visual Product Search</div>
                  <div className="feature-description">Find similar items using image recognition</div>
                </div>
                <div className="feature-card">
                  <span className="feature-icon">🎯</span>
                  <div className="feature-title">Smart Recommendations</div>
                  <div className="feature-description">Get personalized product suggestions</div>
                </div>
                <div className="feature-card">
                  <span className="feature-icon">💡</span>
                  <div className="feature-title">Style Matching</div>
                  <div className="feature-description">Complete your look with complementary items</div>
                </div>
              </div>
            </div>
          )}

          {chatHistory.map((msg, index) => (
            <div key={index} className={`message ${msg.role}`}>
              <div className="message-avatar">
                {msg.role === 'user' ? '👤' : '🤖'}
              </div>
              <div className="message-content">
                {msg.image && (
                  <div className="message-image">
                    <img
                      src={msg.image}
                      alt="Uploaded content"
                      className="uploaded-image"
                    />
                  </div>
                )}
                <div className="message-text">
                  <ReactMarkdown
                    components={{
                      a: ({ node, ...props }) => (
                        <a target="_blank" rel="noopener noreferrer" className="product-link" {...props} />
                      )
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="typing-indicator">
              <div className="message-avatar">🛒</div>
              <div className="typing-dots">
                <div className="dot"></div>
                <div className="dot"></div>
                <div className="dot"></div>
              </div>
            </div>
          )}
        </div>

        <div className="input-area">
          {imagePreview && (
            <div className="image-preview">
              <div className="preview-header">
                <span className="preview-label">🛍️ Product image attached</span>
                <button onClick={handleRemoveImage} className="remove-image-btn">
                  ✕
                </button>
              </div>
              <img src={imagePreview} alt="Preview" />
            </div>
          )}
          <div className="input-container">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="🛍️ Ask for product recommendations...."
              disabled={isLoading}
              rows="1"
              className="message-input"
            />
            <label className="file-input-btn" title="Upload product image">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                disabled={isLoading}
                style={{ display: 'none' }}
              />
              📸
            </label>
            <button
              onClick={sendMessage}
              disabled={isLoading || (!message.trim() && !image)}
              className="send-button"
              title="Send message"
            >
              {isLoading ? '⏳' : '🚀'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;