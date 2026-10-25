const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

const rateLimiter = {
  lastRequest: 0,
  minDelay: 1000, // 1 second between requests
  pendingRequests: new Map()
};

async function sendToAPI(content, imageData = null, threadId = 1) {
  // Check for screen capture trigger
  if (content.trim().toLowerCase() === 'screen capture' && !imageData) {
    // Trigger screen capture instead of API call
    chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
      console.log("Number of tabs:", tabs.length);
      if (tabs[0]) {
        console.log("Current tab ID:", tabs[0].id);
        console.log("Tab details:", tabs[0]);
        
        try {
          // First, ensure content script is injected
          await chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            files: ['content.js']
          });
          console.log('Content script injected');
          
          // Then send the message
          await chrome.tabs.sendMessage(tabs[0].id, {action: 'startCapture'});
          console.log("Sent message to tab ID:", tabs[0].id);
        } catch (error) {
          console.error('Failed to inject content script:', error);
        }
      } 
    });
    return { success: true, message: 'Screen capture started. Select an area on the page.' };
  }

  // Check for add_to_cart commands
  const addToCartMatch = content.trim().match(/^add_to_cart:\("(.+)"\)$/i);
  if (addToCartMatch && !imageData) {
    const productName = addToCartMatch[1];
    
    chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
      if (tabs[0]) {
        try {
          // Ensure content script is injected
          await chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            files: ['content.js']
          });
          
          // Send add to cart command to content script
          await chrome.tabs.sendMessage(tabs[0].id, {
            action: 'addToCart',
            productName: productName
          });
          
          console.log(`Sent add to cart command for: ${productName}`);
        } catch (error) {
          console.error('Failed to execute add to cart command:', error);
        }
      }
    });
    
    return { success: true, message: `Searching for "${productName}" to add to cart...` };
  }

  // Check for scroll commands
  const scrollMatch = content.trim().match(/^scroll(up|down):\s*(\d+)$/i);
  if (scrollMatch && !imageData) {
    const direction = scrollMatch[1].toLowerCase();
    const amount = parseInt(scrollMatch[2]);
    
    chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
      if (tabs[0]) {
        try {
          // Ensure content script is injected
          await chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            files: ['content.js']
          });
          
          // Send scroll command to content script
          await chrome.tabs.sendMessage(tabs[0].id, {
            action: 'scrollPage',
            direction: direction,
            amount: amount
          });
          
          console.log(`Sent scroll command: ${direction} ${amount}px`);
        } catch (error) {
          console.error('Failed to execute scroll command:', error);
        }
      }
    });
    
    return { success: true, message: `Scrolling ${direction} by ${amount}px...` };
  }

  // Check for price commands
  const priceMatch = content.trim().match(/^price:\s*(.+)$/i);
  if (priceMatch && !imageData) {
    try {
      const priceData = JSON.parse(priceMatch[1]);
      
      chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
        if (tabs[0]) {
          try {
            // Ensure content script is injected
            await chrome.scripting.executeScript({
              target: { tabId: tabs[0].id },
              files: ['content.js']
            });
            
            // Send price command to content script
            await chrome.tabs.sendMessage(tabs[0].id, {
              action: 'setPriceRange',
              lower: priceData.lower,
              higher: priceData.higher || priceData.higer // Handle typo in your example
            });
            
            console.log(`Sent price range command: ${priceData.lower} - ${priceData.higher || priceData.higer}`);
          } catch (error) {
            console.error('Failed to execute price command:', error);
          }
        }
      });
      
      const higherValue = priceData.higher || priceData.higer;
      return { success: true, message: `Setting price range: ₹${priceData.lower} - ₹${higherValue}...` };
    } catch (error) {
      return { success: false, error: 'Invalid price format. Use: Price:{"lower":200,"higher":600}' };
    }
  }

  // Check for search commands
  const searchMatch = content.trim().match(/^search:\s*(.+)$/i);
  if (searchMatch && !imageData) {
    const query = searchMatch[1].trim();
    
    chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
      if (tabs[0]) {
        try {
          // Ensure content script is injected
          await chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            files: ['content.js']
          });
          
          // Send search command to content script
          await chrome.tabs.sendMessage(tabs[0].id, {
            action: 'searchFor',
            query: query
          });
          
          console.log(`Sent search command for: ${query}`);
        } catch (error) {
          console.error('Failed to execute search command:', error);
        }
      }
    });
    
    return { success: true, message: `Searching for "${query}"...` };
  }

  // Check for click commands
  const clickMatch = content.trim().toLowerCase().match(/^click on (.+)$/);
  if (clickMatch && !imageData) {
    const target = clickMatch[1];
    
    chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
      if (tabs[0]) {
        try {
          // Ensure content script is injected
          await chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            files: ['content.js']
          });
          
          // Send click command to content script
          await chrome.tabs.sendMessage(tabs[0].id, {
            action: 'clickElement',
            target: target
          });
          
          console.log(`Sent click command for: ${target}`);
        } catch (error) {
          console.error('Failed to execute click command:', error);
        }
      }
    });
    
    return { success: true, message: `Attempting to click on "${target}"...` };
  }

  // Check for checkout commands
  if (content.trim().toLowerCase() === 'checkout_cart' && !imageData) {
    chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
      if (tabs[0]) {
        try {
          // Ensure content script is injected
          await chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            files: ['content.js']
          });
          
          // Send checkout command to content script
          await chrome.tabs.sendMessage(tabs[0].id, {
            action: 'proceedToCheckout'
          });
          
          console.log('Sent checkout command');
        } catch (error) {
          console.error('Failed to execute checkout command:', error);
        }
      }
    });
    
    return { success: true, message: 'Proceeding to checkout...' };
  }

  // Check for navigate to cart commands
  if (content.trim().toLowerCase() === 'goto_cart' && !imageData) {
    chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
      if (tabs[0]) {
        try {
          // Ensure content script is injected
          await chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            files: ['content.js']
          });
          
          // Send navigate to cart command to content script
          await chrome.tabs.sendMessage(tabs[0].id, {
            action: 'navigateToCart'
          });
          
          console.log('Sent navigate to cart command');
        } catch (error) {
          console.error('Failed to execute navigate to cart command:', error);
        }
      }
    });
    
    return { success: true, message: 'Navigating to shopping cart...' };
  }

  // Check if this exact request is already pending
  const requestKey = content.trim();
  if (rateLimiter.pendingRequests.has(requestKey)) {
    return rateLimiter.pendingRequests.get(requestKey);
  }

  // Implement rate limiting
  const now = Date.now();
  if (now - rateLimiter.lastRequest < rateLimiter.minDelay) {
    return { success: false, error: 'Please wait a moment before sending another request.' };
  }
  rateLimiter.lastRequest = now;

  // Create a new promise for this request
  const requestPromise = (async () => {
    try {
      if (!content.trim() && !imageData) {
        throw new Error('Please enter some text or upload an image.');
      }

      // Prepare FormData for Flask backend
      const formData = new FormData();
      
      if (content.trim()) {
        formData.append('message', content);
      }

      formData.append('thread_id', threadId.toString());

      if (imageData) {
        // Convert base64 data URL to blob
        const base64Data = imageData.data.split(',')[1]; // Remove data:image/jpeg;base64, prefix
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: imageData.type });
        
        // Append as file with proper filename
        formData.append('image', blob, imageData.name);
      }

      const response = await fetch('http://127.0.0.1:5000/chat', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      return { success: true, message: data.reply };
    } catch (error) {
      return { 
        success: false, 
        error: error.message
      };
    } finally {
      // Clean up the pending request
      rateLimiter.pendingRequests.delete(requestKey);
    }
  })();

  // Store the promise in pending requests
  rateLimiter.pendingRequests.set(requestKey, requestPromise);
  return requestPromise;
}

async function captureScreenArea(tabId, captureData) {
  try {
    console.log('Capturing screen area:', captureData);
    
    // Capture the visible tab
    const dataUrl = await chrome.tabs.captureVisibleTab(null, {
      format: 'png',
      quality: 100
    });

    console.log('Tab captured, cropping image...');

    // Create a canvas using OffscreenCanvas (available in service workers)
    const canvas = new OffscreenCanvas(captureData.width, captureData.height);
    const ctx = canvas.getContext('2d');

    // Create ImageBitmap from the captured data URL
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const imageBitmap = await createImageBitmap(blob);

    // Account for device pixel ratio
    const ratio = captureData.devicePixelRatio;
    const cropX = captureData.left * ratio;
    const cropY = captureData.top * ratio;
    const cropWidth = captureData.width * ratio;
    const cropHeight = captureData.height * ratio;

    console.log('Cropping with dimensions:', { cropX, cropY, cropWidth, cropHeight });

    // Set canvas size to the cropped area
    canvas.width = cropWidth;
    canvas.height = cropHeight;

    // Draw the cropped portion
    ctx.drawImage(
      imageBitmap,
      cropX, cropY, cropWidth, cropHeight,
      0, 0, cropWidth, cropHeight
    );

    // Convert canvas to blob and then to data URL
    const croppedBlob = await canvas.convertToBlob({ type: 'image/png' });
    const reader = new FileReader();
    
    return new Promise((resolve) => {
      reader.onload = () => {
        console.log('Image cropped successfully, sending to popup');
        resolve({
          success: true,
          imageData: {
            data: reader.result,
            type: 'image/png',
            name: 'screen-capture.png'
          }
        });
      };
      
      reader.onerror = () => {
        console.error('Failed to convert blob to data URL');
        resolve({
          success: false,
          error: 'Failed to process captured image'
        });
      };
      
      reader.readAsDataURL(croppedBlob);
    });

  } catch (error) {
    console.error('Capture error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Capture full page automatically using captureVisibleTab API
async function captureFullPage() {
  try {
    console.log('Capturing full page of current active tab');
    
    // Capture the visible tab directly
    const dataUrl = await chrome.tabs.captureVisibleTab(null, {
      format: 'png',
      quality: 100
    });

    console.log('Full page captured successfully');

    return {
      success: true,
      imageData: {
        data: dataUrl,
        type: 'image/png',
        name: 'full-page-capture.png'
      }
    };

  } catch (error) {
    console.error('Full page capture error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request);
  
  if (request.action === 'sendToAPI') {
    sendToAPI(request.content, request.image, request.thread_id)
      .then(sendResponse)
      .catch(error => {
        sendResponse({ 
          success: false, 
          error: error.message || 'API request failed'
        });
      });
    return true; // Required for async response
  } else if (request.action === 'captureScreen') {
    console.log('Processing capture screen request');
    captureScreenArea(sender.tab.id, request.data)
      .then(result => {
        console.log('Capture result:', result);
        sendResponse(result);
        
        if (result.success) {
          // Send the captured image to the popup
          console.log('Broadcasting captured image to popup');
          chrome.runtime.sendMessage({
            action: 'capturedImage',
            imageData: result.imageData
          }).catch(error => {
            console.log('No popup listening, that\'s normal');
          });
        }
      })
      .catch(error => {
        console.error('Capture error:', error);
        sendResponse({
          success: false,
          error: error.message
        });
      });
    return true;
  } else if (request.action === 'captureFullPage') {
    console.log('Processing full page capture request');
    captureFullPage()
      .then(result => {
        console.log('Full page capture result:', result);
        sendResponse(result);
      })
      .catch(error => {
        console.error('Full page capture error:', error);
        sendResponse({
          success: false,
          error: error.message
        });
      });
    return true;
  } else if (request.action === 'startCapture') {
    // Forward to content script
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {action: 'startCapture'}, sendResponse);
      }
    });
    return true;
  } else if (request.action === 'clickResult') {
    // Forward click results to popup if it's listening
    console.log('Click result:', request);
    chrome.runtime.sendMessage({
      action: 'clickFeedback',
      success: request.success,
      message: request.message
    }).catch(error => {
      console.log('No popup listening for click feedback');
    });
    sendResponse({ received: true });
  }
});

// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.url.startsWith('chrome://') || tab.url.startsWith('about:')) {
    return;
  }
  
  try {
    await chrome.sidePanel.open({ tabId: tab.id });
  } catch (error) {
    console.error('Failed to open panel:', error);
    chrome.windows.create({
      url: 'src/popup.html',
      type: 'popup',
      width: 400,
      height: 600
    });
  }
});

// Initialize sidebar on install for Firefox
function getBrowserType() {
  return typeof browser !== 'undefined' ? 'firefox' : 'chrome';
}

if (getBrowserType() === 'firefox') {
  browser.runtime.onInstalled.addListener(() => {
    browser.sidebarAction.open();
  });
}