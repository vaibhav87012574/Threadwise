const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

document.addEventListener('DOMContentLoaded', function() {
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const uploadButton = document.getElementById('uploadButton');
    const captureButton = document.getElementById('captureButton');
    const fileInput = document.getElementById('fileInput');
    const imagePreviewContainer = document.getElementById('imagePreviewContainer');
    const imagePreview = document.getElementById('imagePreview');
    const removeImageButton = document.getElementById('removeImage');
    const chatMessages = document.getElementById('chatMessages');
    const typingIndicator = document.getElementById('typingIndicator');
    const emptyState = document.getElementById('emptyState');
    const newChatButton = document.getElementById('newChatButton');

    let selectedImage = null;
    let currentThreadId = 1;

    console.log('Chat popup loaded');

    // Load chat history on startup
    loadChatHistory();

    // Function to load chat history
    async function loadChatHistory() {
        try {
            console.log('Loading chat history...');
            const response = await fetch(`http://127.0.0.1:5000/chat?thread_id=${currentThreadId}`, {
                method: 'GET'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Chat history loaded:', data);

            if (data.messages && data.messages.length > 0) {
                // Hide empty state
                emptyState.style.display = 'none';
                
                // Display each message
                data.messages.forEach(msg => {
                    const image = msg.image ? {
                        data: msg.image,
                        type: 'image/jpeg',
                        name: 'previous-image.jpg'
                    } : null;
                    
                    addMessage(msg.content, msg.role === 'user' ? 'user' : 'bot', image);
                });
            }
        } catch (error) {
            console.error('Failed to load chat history:', error);
            // Don't show error notification for history loading failure
        }
    }

    // Function to start new chat
    async function startNewChat() {
        currentThreadId++;
        console.log('Starting new chat with thread ID:', currentThreadId);
        
        // Clear current chat
        chatMessages.innerHTML = '';
        emptyState.style.display = 'flex';
        
        // Load new thread's history
        await loadChatHistory();
        
        showNotification(`Started new chat (Thread ${currentThreadId})`, 'success');
    }

    // Listen for captured images from background
    browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('Popup received message:', message);
        
        if (message.action === 'capturedImage') {
            console.log('Processing captured image:', message.imageData);
            
            selectedImage = {
                data: message.imageData.data,
                type: message.imageData.type,
                name: message.imageData.name
            };
            
            // Show preview
            imagePreview.src = message.imageData.data;
            imagePreviewContainer.style.display = 'block';
            
            // Auto-fill with a helpful prompt
            if (!messageInput.value.trim()) {
                messageInput.value = "";
                // Trigger auto-resize
                messageInput.style.height = 'auto';
                messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
            }
            
            console.log('Image preview set and prompt added');
            
            // Focus on the input
            messageInput.focus();
            
            // Show a success notification
            showNotification('Image captured! Add your question and send.', 'success');
        }
        
        // Always send response for message handling
        if (sendResponse) {
            sendResponse({ received: true });
        }
    });

    // Notification function
    function showNotification(text, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
            color: white;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 12px;
            z-index: 1000;
            max-width: 250px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        `;
        notification.textContent = text;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 3000);
    }

    // Simple markdown parser
    function parseMarkdown(text) {
        let html = text;
        
        // Convert **bold** to <strong>
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // Convert *italic* to <em>
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        // Convert [text](url) to links
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
        
        // Convert bullet points (*)
        html = html.replace(/^\* (.+)$/gm, '<li>$1</li>');
        
        // Wrap consecutive <li> tags in <ul>
        html = html.replace(/(<li>.*<\/li>)/gs, function(match) {
            const lines = match.split('\n').filter(line => line.trim());
            if (lines.length > 0) {
                return '<ul>' + lines.join('') + '</ul>';
            }
            return match;
        });
        
        // Convert line breaks to paragraphs
        const paragraphs = html.split('\n\n').filter(p => p.trim());
        html = paragraphs.map(p => {
            p = p.trim();
            // Don't wrap lists in paragraphs
            if (p.startsWith('<ul>') || p.startsWith('<ol>')) {
                return p;
            }
            return `<p>${p}</p>`;
        }).join('');
        
        return html;
    }

    // Auto-resize textarea
    messageInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });

    // Upload button click
    uploadButton.addEventListener('click', function() {
        fileInput.click();
    });

    // Capture button click
    captureButton.addEventListener('click', async function() {
        console.log('Capture button clicked');
        
        try {
            // First check if we can get the active tab
            const tabs = await browserAPI.tabs.query({active: true, currentWindow: true});
            console.log('Active tabs:', tabs);
            
            if (!tabs || tabs.length === 0) {
                throw new Error('No active tab found');
            }
            
            const tab = tabs[0];
            
            // Check if it's a restricted page
            if (tab.url.startsWith('chrome://') || 
                tab.url.startsWith('about:') || 
                tab.url.startsWith('moz-extension://') ||
                tab.url.startsWith('chrome-extension://')) {
                throw new Error('Cannot capture on this page. Please switch to a regular website.');
            }
            
            // Try to inject content script if it's not already there
            try {
                await browserAPI.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['content.js']
                });
                console.log('Content script injected');
            } catch (injectError) {
                console.log('Content script may already be injected:', injectError.message);
            }
            
            // Also inject CSS
            try {
                await browserAPI.scripting.insertCSS({
                    target: { tabId: tab.id },
                    files: ['capture-overlay.css']
                });
                console.log('CSS injected');
            } catch (cssError) {
                console.log('CSS may already be injected:', cssError.message);
            }
            
            // Wait a bit for injection
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Send message to start capture
            const response = await browserAPI.tabs.sendMessage(tab.id, {action: 'startCapture'});
            console.log('Capture start response:', response);
            
            // Show notification
            showNotification('Click and drag on the page to capture!', 'info');
            
        } catch (error) {
            console.error('Capture error:', error);
            showNotification(error.message || 'Failed to start capture. Try refreshing the page.', 'error');
        }
    });

    // File input change
    fileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = function(e) {
                selectedImage = {
                    data: e.target.result,
                    type: file.type,
                    name: file.name
                };
                
                // Show preview
                imagePreview.src = e.target.result;
                imagePreviewContainer.style.display = 'block';
                
                showNotification('Image uploaded!', 'success');
            };
            reader.readAsDataURL(file);
        }
    });

    // Remove image
    removeImageButton.addEventListener('click', function() {
        selectedImage = null;
        imagePreviewContainer.style.display = 'none';
        fileInput.value = '';
        showNotification('Image removed', 'info');
    });

    // Send message function
    async function sendMessage() {
        const message = messageInput.value.trim();
        
        if (!message && !selectedImage) {
            showNotification('Please enter a message or select an image', 'error');
            return;
        }

        console.log('Sending message:', message, 'with image:', selectedImage ? selectedImage.name : 'none');

        // Hide empty state
        emptyState.style.display = 'none';

        // Add user message to chat
        addMessage(message, 'user', selectedImage);
        
        // Clear input and reset height
        messageInput.value = '';
        messageInput.style.height = 'auto';
        
        // Clear image
        const imageToSend = selectedImage;
        selectedImage = null;
        imagePreviewContainer.style.display = 'none';
        fileInput.value = '';
        
        // Show typing indicator
        showTyping();
        
        // Disable send button
        sendButton.disabled = true;

        try {
            console.log('Sending to background script');
            
            // Prepare data for background script
            const requestData = {
                action: 'sendToAPI',
                content: message,
                thread_id: currentThreadId
            };

            // If there's an image, use it directly
            if (imageToSend) {
                requestData.image = imageToSend;
            }

            const response = await browserAPI.runtime.sendMessage(requestData);

            console.log('Response received:', response);

            // Hide typing indicator
            hideTyping();

            if (response && response.success) {
                addMessage(response.message, 'bot');
            } else {
                const errorMsg = response ? response.error : 'Unknown error occurred';
                addMessage(`Sorry, I encountered an error: ${errorMsg}`, 'bot', null, true);
            }
        } catch (error) {
            console.error('Error sending message:', error);
            hideTyping();
            addMessage(`Sorry, I encountered an error: ${error.message}`, 'bot', null, true);
        } finally {
            sendButton.disabled = false;
        }
    }

    // Add message to chat
    function addMessage(text, sender, image = null, isError = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        
        const avatar = document.createElement('div');
        avatar.className = `avatar ${sender}`;
        avatar.textContent = sender === 'user' ? '👤' : '🤖';
        
        const content = document.createElement('div');
        content.className = 'message-content';
        
        // Add image if present
        if (image && sender === 'user') {
            const img = document.createElement('img');
            img.className = 'message-image';
            img.src = image.data;
            img.style.maxWidth = '200px';
            img.style.borderRadius = '0.5rem';
            img.style.marginBottom = '0.5rem';
            img.style.display = 'block';
            content.appendChild(img);
        }
        
        // Add text if present
        if (text) {
            const textDiv = document.createElement('div');
            
            if (sender === 'bot' && !isError) {
                // Parse markdown for bot messages
                textDiv.innerHTML = parseMarkdown(text);
            } else {
                // Plain text for user messages and errors
                textDiv.textContent = text;
            }
            
            content.appendChild(textDiv);
        }
        
        if (isError) {
            content.style.color = '#ef4444';
            content.style.borderColor = '#fecaca';
            content.style.background = '#fef2f2';
        }
        
        if (sender === 'user') {
            messageDiv.appendChild(content);
            messageDiv.appendChild(avatar);
        } else {
            messageDiv.appendChild(avatar);
            messageDiv.appendChild(content);
        }
        
        chatMessages.appendChild(messageDiv);
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Show typing indicator
    function showTyping() {
        typingIndicator.style.display = 'flex';
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Hide typing indicator
    function hideTyping() {
        typingIndicator.style.display = 'none';
    }

    // Event listeners
    sendButton.addEventListener('click', sendMessage);
    newChatButton.addEventListener('click', startNewChat);

    messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Focus input on load
    messageInput.focus();
});