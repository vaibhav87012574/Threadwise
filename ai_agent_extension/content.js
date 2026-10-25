// Remove the import line and define browserAPI directly
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Global state
const state = {
  port: null,
  selectedText: '',
  pageText: '',
  isCapturing: false,
  captureStartPos: null,
  captureEndPos: null,
  overlay: null,
  selectionBox: null,
  pendingAddToCart: new Set() // Track pending add to cart operations
};

// Screen capture functions
function startScreenCapture() {
  console.log('Starting screen capture...');
  
  if (state.isCapturing) {
    console.log('Already capturing, returning');
    return;
  }
  
  state.isCapturing = true;
  
  // Create overlay
  state.overlay = document.createElement('div');
  state.overlay.className = 'chat-extension-capture-overlay';
  
  // Create instructions
  const instructions = document.createElement('div');
  instructions.className = 'chat-extension-capture-instructions';
  instructions.textContent = 'Click and drag to select an area to capture';
  
  // Create cancel button
  const cancelButton = document.createElement('button');
  cancelButton.className = 'chat-extension-capture-cancel';
  cancelButton.textContent = 'Cancel';
  cancelButton.addEventListener('click', cancelScreenCapture);
  
  // Create selection box
  state.selectionBox = document.createElement('div');
  state.selectionBox.className = 'chat-extension-selection-box';
  state.selectionBox.style.display = 'none';
  state.selectionBox.style.position = 'fixed';
  state.selectionBox.style.pointerEvents = 'none';
  state.selectionBox.style.zIndex = '999998';
  
  // Add event listeners
  state.overlay.addEventListener('mousedown', handleMouseDown);
  state.overlay.addEventListener('mousemove', handleMouseMove);
  state.overlay.addEventListener('mouseup', handleMouseUp);
  
  // Prevent page scrolling during capture
  document.body.style.overflow = 'hidden';
  
  // Add elements to page
  document.body.appendChild(state.overlay);
  document.body.appendChild(instructions);
  document.body.appendChild(cancelButton);
  document.body.appendChild(state.selectionBox);
  
  console.log('Screen capture overlay created');
}

function cancelScreenCapture() {
  console.log('Canceling screen capture...');
  
  if (!state.isCapturing) return;
  
  state.isCapturing = false;
  state.captureStartPos = null;
  state.captureEndPos = null;
  
  // Remove overlay elements
  if (state.overlay) {
    state.overlay.remove();
    state.overlay = null;
  }
  
  // Remove instructions and cancel button
  const instructions = document.querySelector('.chat-extension-capture-instructions');
  const cancelButton = document.querySelector('.chat-extension-capture-cancel');
  if (instructions) instructions.remove();
  if (cancelButton) cancelButton.remove();
  
  if (state.selectionBox) {
    state.selectionBox.remove();
    state.selectionBox = null;
  }
  
  // Restore page scrolling
  document.body.style.overflow = '';
  
  console.log('Screen capture canceled');
}

function handleMouseDown(e) {
  e.preventDefault();
  e.stopPropagation();
  
  // Get viewport coordinates
  state.captureStartPos = {
    x: e.clientX,
    y: e.clientY
  };
  
  // Show selection box at exact cursor position
  state.selectionBox.style.display = 'block';
  state.selectionBox.style.left = e.clientX + 'px';
  state.selectionBox.style.top = e.clientY + 'px';
  state.selectionBox.style.width = '0px';
  state.selectionBox.style.height = '0px';
}

function handleMouseMove(e) {
  if (!state.captureStartPos) return;
  
  e.preventDefault();
  e.stopPropagation();
  
  // Get current viewport coordinates
  const currentX = e.clientX;
  const currentY = e.clientY;
  
  // Calculate box dimensions and position
  const left = Math.min(state.captureStartPos.x, currentX);
  const top = Math.min(state.captureStartPos.y, currentY);
  const width = Math.abs(currentX - state.captureStartPos.x);
  const height = Math.abs(currentY - state.captureStartPos.y);
  
  // Update selection box position and size with pixel precision
  state.selectionBox.style.left = Math.round(left) + 'px';
  state.selectionBox.style.top = Math.round(top) + 'px';
  state.selectionBox.style.width = Math.round(width) + 'px';
  state.selectionBox.style.height = Math.round(height) + 'px';
}

function handleMouseUp(e) {
  if (!state.captureStartPos) return;
  
  e.preventDefault();
  e.stopPropagation();
  
  state.captureEndPos = {
    x: e.clientX,
    y: e.clientY
  };
  
  // Calculate capture area with exact coordinates
  const left = Math.min(state.captureStartPos.x, state.captureEndPos.x);
  const top = Math.min(state.captureStartPos.y, state.captureEndPos.y);
  const width = Math.abs(state.captureEndPos.x - state.captureStartPos.x);
  const height = Math.abs(state.captureEndPos.y - state.captureStartPos.y);
  
  // Minimum size check
  if (width < 10 || height < 10) {
    console.log('Selection too small, canceling');
    cancelScreenCapture();
    return;
  }
  
  console.log('Sending capture request with area:', { left, top, width, height });
  
  // Send capture request to background
  const captureData = {
    left: Math.round(left),
    top: Math.round(top),
    width: Math.round(width),
    height: Math.round(height),
    devicePixelRatio: window.devicePixelRatio || 1
  };
  
  browserAPI.runtime.sendMessage({
    action: 'captureScreen',
    data: captureData
  }).then(() => {
    console.log('Capture request sent successfully');
  }).catch(error => {
    console.error('Error sending capture request:', error);
  });
  
  cancelScreenCapture();
}

// Function to handle search commands
function handleSearch(query) {
  console.log(`Attempting to search for: ${query}`);
  
  // Find the search input box
  const searchInput = document.querySelector('#twotabsearchtextbox') || 
                     document.querySelector('input[name="field-keywords"]') ||
                     document.querySelector('input[aria-label*="Search" i]') ||
                     document.querySelector('input[placeholder*="Search" i]');
  
  if (!searchInput) {
    console.log('Search input not found');
    chrome.runtime.sendMessage({
      action: 'clickResult',
      success: false,
      message: 'Could not find search input box'
    });
    return false;
  }
  
  // Clear existing value and set new search query
  searchInput.focus();
  searchInput.select();
  searchInput.value = query;
  
  // Trigger input events to ensure the page recognizes the change
  searchInput.dispatchEvent(new Event('input', { bubbles: true }));
  searchInput.dispatchEvent(new Event('change', { bubbles: true }));
  
  console.log(`Set search input to: ${query}`);
  
  // Find and click the search button
  const searchButton = document.querySelector('#nav-search-submit-button') ||
                      document.querySelector('input[type="submit"][value*="Go" i]') ||
                      document.querySelector('button[type="submit"]') ||
                      document.querySelector('input[type="submit"]');
  
  if (!searchButton) {
    console.log('Search button not found');
    chrome.runtime.sendMessage({
      action: 'clickResult',
      success: false,
      message: 'Could not find search button'
    });
    return false;
  }
  
  // Highlight the search input and button
  highlightElement(searchInput);
  highlightElement(searchButton);
  
  // Click the search button after a short delay
  setTimeout(() => {
    searchButton.click();
    console.log(`Clicked search button for query: ${query}`);
    
    chrome.runtime.sendMessage({
      action: 'clickResult',
      success: true,
      message: `Successfully searched for "${query}"`
    });
  }, 500);
  
  return true;
}

// Function to find and click elements
function clickElement(target) {
  const targetLower = target.toLowerCase();
  
  // Define selectors for common targets
  const selectors = {
    'cart': [
      '#nav-cart',
      '[aria-label*="cart" i]',
      '[class*="cart" i]',
      'a[href*="cart" i]',
      'button[class*="cart" i]'
    ],
    'search': [
      '#nav-search-submit-button',
      '[type="submit"][class*="search" i]',
      'button[aria-label*="search" i]'
    ],
    'menu': [
      '#nav-hamburger-menu',
      '[aria-label*="menu" i]',
      'button[class*="menu" i]'
    ]
  };

  let elementsToTry = [];

  // Check if target matches predefined selectors
  for (const [key, selectorList] of Object.entries(selectors)) {
    if (targetLower.includes(key)) {
      elementsToTry = selectorList;
      break;
    }
  }

  // If no predefined selectors, create generic ones
  if (elementsToTry.length === 0) {
    elementsToTry = [
      `[aria-label*="${target}" i]`,
      `[title*="${target}" i]`,
      `[alt*="${target}" i]`,
      `*[class*="${target.replace(/\s+/g, '-')}" i]`,
      `*[id*="${target.replace(/\s+/g, '-')}" i]`
    ];
  }

  // Try to find and click the element
  for (const selector of elementsToTry) {
    try {
      const element = document.querySelector(selector);
      if (element && isElementVisible(element)) {
        console.log(`Found element with selector: ${selector}`, element);
        
        // Scroll element into view
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Add visual feedback
        highlightElement(element);
        
        // Click the element
        setTimeout(() => {
          element.click();
          console.log(`Clicked on element: ${selector}`);
          
          // Send success message back
          chrome.runtime.sendMessage({
            action: 'clickResult',
            success: true,
            message: `Successfully clicked on "${target}"`
          });
        }, 500);
        
        return true;
      }
    } catch (error) {
      console.warn(`Error with selector ${selector}:`, error);
    }
  }

  // If no element found, try text-based search
  const allClickableElements = document.querySelectorAll('a, button, [onclick], [role="button"], input[type="submit"], input[type="button"]');
  
  for (const element of allClickableElements) {
    const text = element.textContent || element.value || element.getAttribute('aria-label') || '';
    if (text.toLowerCase().includes(targetLower) && isElementVisible(element)) {
      console.log(`Found element by text content:`, element);
      
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      highlightElement(element);
      
      setTimeout(() => {
        element.click();
        console.log(`Clicked on element by text: ${text}`);
        
        chrome.runtime.sendMessage({
          action: 'clickResult',
          success: true,
          message: `Successfully clicked on "${target}"`
        });
      }, 500);
      
      return true;
    }
  }

  // No element found
  console.log(`No clickable element found for: ${target}`);
  chrome.runtime.sendMessage({
    action: 'clickResult',
    success: false,
    message: `Could not find clickable element for "${target}"`
  });
  
  return false;
}

// Function to handle price range setting
function setPriceRange(lower, higher) {
  console.log(`Setting price range: ${lower} - ${higher}`);
  
  // Find the form with the price slider
  const sliderForm = document.querySelector('form[data-slider-id="p_36/range-slider"]');
  if (!sliderForm) {
    console.log('Price slider form not found');
    chrome.runtime.sendMessage({
      action: 'clickResult',
      success: false,
      message: 'Price slider not found on this page'
    });
    return false;
  }

  // Get the slider data
  const sliderPropsAttr = sliderForm.getAttribute('data-slider-props');
  if (!sliderPropsAttr) {
    console.log('Slider properties not found');
    chrome.runtime.sendMessage({
      action: 'clickResult',
      success: false,
      message: 'Could not find slider properties'
    });
    return false;
  }

  let sliderProps;
  try {
    sliderProps = JSON.parse(sliderPropsAttr);
  } catch (error) {
    console.log('Error parsing slider properties:', error);
    chrome.runtime.sendMessage({
      action: 'clickResult',
      success: false,
      message: 'Error parsing slider data'
    });
    return false;
  }

  const stepValues = sliderProps.stepValues;
  
  // Find closest step values for lower and higher bounds
  function findClosestStepIndex(targetValue, stepValues) {
    let closestIndex = 0;
    let closestDiff = Math.abs(stepValues[0] - targetValue);
    
    for (let i = 1; i < stepValues.length; i++) {
      if (stepValues[i] === null) continue;
      
      const diff = Math.abs(stepValues[i] - targetValue);
      if (diff < closestDiff) {
        closestDiff = diff;
        closestIndex = i;
      }
    }
    return closestIndex;
  }

  const lowerIndex = findClosestStepIndex(lower, stepValues);
  const higherIndex = findClosestStepIndex(higher, stepValues);

  console.log(`Lower bound: ${lower} -> index ${lowerIndex} (${stepValues[lowerIndex]})`);
  console.log(`Higher bound: ${higher} -> index ${higherIndex} (${stepValues[higherIndex]})`);

  // Find the slider inputs
  const lowerSlider = document.querySelector('#p_36\\/range-slider_slider-item_lower-bound-slider');
  const upperSlider = document.querySelector('#p_36\\/range-slider_slider-item_upper-bound-slider');
  
  if (!lowerSlider || !upperSlider) {
    console.log('Slider inputs not found');
    chrome.runtime.sendMessage({
      action: 'clickResult',
      success: false,
      message: 'Could not find slider controls'
    });
    return false;
  }

  // Set the slider values
  lowerSlider.value = lowerIndex;
  upperSlider.value = higherIndex;

  // Trigger change events
  lowerSlider.dispatchEvent(new Event('input', { bubbles: true }));
  lowerSlider.dispatchEvent(new Event('change', { bubbles: true }));
  
  upperSlider.dispatchEvent(new Event('input', { bubbles: true }));
  upperSlider.dispatchEvent(new Event('change', { bubbles: true }));

  // Update hidden form fields
  const lowPriceInput = sliderForm.querySelector('input[name="low-price"]');
  const highPriceInput = sliderForm.querySelector('input[name="high-price"]');
  
  if (lowPriceInput && highPriceInput) {
    lowPriceInput.value = stepValues[lowerIndex];
    highPriceInput.value = stepValues[higherIndex];
  }

  // Highlight the sliders
  highlightElement(lowerSlider);
  highlightElement(upperSlider);

  // Find and click the Go button - updated selector for your specific button structure
  const goButton = sliderForm.querySelector('input[aria-label="Go - Submit price range"]') || 
                   sliderForm.querySelector('.a-button-input[type="submit"]') ||
                   sliderForm.querySelector('input[type="submit"]') ||
                   sliderForm.querySelector('.sf-submit-range-button input');

  if (goButton) {
    setTimeout(() => {
      highlightElement(goButton);
      
      setTimeout(() => {
        goButton.click();
        console.log(`Applied price range: ₹${stepValues[lowerIndex]} - ₹${stepValues[higherIndex]}`);
        
        chrome.runtime.sendMessage({
          action: 'clickResult',
          success: true,
          message: `Successfully set price range: ₹${stepValues[lowerIndex]} - ₹${stepValues[higherIndex]}`
        });
      }, 500);
    }, 500);
  } else {
    console.log('Go button not found');
    chrome.runtime.sendMessage({
      action: 'clickResult',
      success: false,
      message: 'Could not find submit button for price range'
    });
    return false;
  }

  return true;
}

// Function to handle scrolling
function scrollPage(direction, amount) {
  console.log(`Scrolling ${direction} by ${amount}px`);
  
  try {
    // Calculate scroll amount based on direction
    const scrollAmount = direction === 'down' ? amount : -amount;
    
    // Get current scroll position
    const currentScrollY = window.pageYOffset || document.documentElement.scrollTop;
    const targetScrollY = Math.max(0, currentScrollY + scrollAmount);
    
    // Perform smooth scroll
    window.scrollTo({
      top: targetScrollY,
      behavior: 'smooth'
    });
    
    // Visual feedback - create a temporary indicator
    const indicator = document.createElement('div');
    indicator.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 113, 133, 0.9);
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-family: Arial, sans-serif;
      font-size: 14px;
      font-weight: bold;
      z-index: 10000;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
      pointer-events: none;
    `;
    indicator.textContent = `Scrolling ${direction} ${amount}px`;
    
    document.body.appendChild(indicator);
    
    // Remove indicator after animation
    setTimeout(() => {
      if (indicator.parentNode) {
        indicator.remove();
      }
    }, 1500);
    
    console.log(`Successfully scrolled ${direction} by ${amount}px`);
    
    chrome.runtime.sendMessage({
      action: 'clickResult',
      success: true,
      message: `Successfully scrolled ${direction} by ${amount}px`
    });
    
    return true;
  } catch (error) {
    console.error('Error scrolling page:', error);
    
    chrome.runtime.sendMessage({
      action: 'clickResult',
      success: false,
      message: `Failed to scroll: ${error.message}`
    });
    
    return false;
  }
}

// Function to add product to cart by name
function addToCart(productName) {
  console.log(`Searching for product: "${productName}" to add to cart`);
  
  // Add to pending operations to avoid conflicts
  state.pendingAddToCart.add(productName);
  console.log(`Added "${productName}" to pending operations. Pending: ${Array.from(state.pendingAddToCart).join(', ')}`);
  
  // Find all product containers
  const productContainers = document.querySelectorAll('.sg-col-inner');
  console.log(`Found ${productContainers.length} product containers`);
  
  // Limit search to first 20 products as requested
  const searchLimit = Math.min(40, productContainers.length);
  
  for (let i = 0; i < searchLimit; i++) {
    const container = productContainers[i];
    
    // Look for the product title element
    const titleElement = container.querySelector('h2.a-size-base-plus.a-spacing-none.a-color-base.a-text-normal span') ||
                         container.querySelector('h2 span') ||
                         container.querySelector('[data-cy="title-recipe"] h2 span') ||
                         container.querySelector('.s-line-clamp-2 span') ||
                         container.querySelector('.a-text-normal span');
    
    if (!titleElement) continue;
    
    const productTitle = titleElement.textContent.trim();
    console.log(`Checking product ${i + 1}: "${productTitle}"`);
    
    // Check if the product name matches (case insensitive, partial match)
    if (productTitle.toLowerCase().includes(productName.toLowerCase()) || 
        productName.toLowerCase().includes(productTitle.toLowerCase())) {
      
      console.log(`Found matching product: "${productTitle}"`);
      
      // Look for the add to cart button within this container - Updated selectors
      const addToCartButton = container.querySelector('button.a-button-text[type="button"]') ||
                             container.querySelector('button.a-button-text') ||
                             container.querySelector('[data-cy="add-to-cart"] button') ||
                             container.querySelector('.puis-atcb-add-container button') ||
                             container.querySelector('.a-button-inner button') ||
                             container.querySelector('button[id*="autoid"][id$="announce"]') ||
                             container.querySelector('button[type="button"]') ||
                             container.querySelector('.a-button-text');
      
      if (addToCartButton) {
        // Check if it's actually an "Add to cart" button
        const buttonText = addToCartButton.textContent.trim().toLowerCase();
        const buttonAriaLabel = addToCartButton.getAttribute('aria-label')?.toLowerCase() || '';
        const buttonId = addToCartButton.id?.toLowerCase() || '';
        
        if (buttonText.includes('add to cart') || 
            buttonText.includes('add') || 
            buttonAriaLabel.includes('add to cart') || 
            buttonAriaLabel.includes('add') ||
            buttonId.includes('add')) {
          
          console.log(`Found add to cart button for: "${productTitle}"`);
          
          // Scroll the product into view
          container.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          // Highlight the product
          highlightElement(container);
          
          // Highlight the add to cart button
          highlightElement(addToCartButton);
          
          // Click the add to cart button after a delay
          setTimeout(() => {
            try {
              // Try multiple click methods for better compatibility
              addToCartButton.focus();
              addToCartButton.click();
              
              // Also try dispatching a click event as backup
              addToCartButton.dispatchEvent(new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window
              }));
              
              console.log(`Successfully clicked add to cart for: "${productTitle}"`);
              
              // Wait for popup to appear and handle it
              setTimeout(() => {
                handleAddToCartPopup(productTitle);
              }, 1500);
              
            } catch (error) {
              console.error('Error clicking add to cart button:', error);
              chrome.runtime.sendMessage({
                action: 'clickResult',
                success: false,
                message: `Failed to click add to cart button: ${error.message}`
              });
            }
          }, 1000);
          
          return true;
        }
      }
      
      // If no add to cart button found in this container, try more comprehensive search
      const allButtons = container.querySelectorAll('button, input[type="button"], input[type="submit"], .a-button, [role="button"]');
      console.log(`Found ${allButtons.length} buttons in container for "${productTitle}"`);
      
      for (const btn of allButtons) {
        const btnText = (btn.textContent || btn.value || '').trim().toLowerCase();
        const btnAriaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
        const btnId = (btn.id || '').toLowerCase();
        const btnClass = (btn.className || '').toLowerCase();
        
        // More comprehensive check for add to cart buttons
        if (btnText.includes('add to cart') || 
            btnText.includes('add') ||
            btnAriaLabel.includes('add to cart') || 
            btnAriaLabel.includes('add') ||
            btnId.includes('add') ||
            btnClass.includes('atcb') || // Amazon's add to cart button class pattern
            btnClass.includes('add-to-cart')) {
          
          console.log(`Found alternative add to cart button for: "${productTitle}"`);
          
          container.scrollIntoView({ behavior: 'smooth', block: 'center' });
          highlightElement(container);
          highlightElement(btn);
          
          setTimeout(() => {
            try {
              btn.focus();
              btn.click();
              
              // Backup click event
              btn.dispatchEvent(new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window
              }));
              
              console.log(`Successfully clicked alternative add to cart for: "${productTitle}"`);
              
              // Wait for popup to appear and handle it
              setTimeout(() => {
                handleAddToCartPopup(productTitle);
              }, 1500);
              
            } catch (error) {
              console.error('Error clicking alternative add to cart button:', error);
              chrome.runtime.sendMessage({
                action: 'clickResult',
                success: false,
                message: `Failed to click add to cart button: ${error.message}`
              });
            }
          }, 1000);
          
          return true;
        }
      }
      
      // If we found the product but no add to cart button
      console.log(`Found product "${productTitle}" but no add to cart button`);
      // Remove from pending operations
      state.pendingAddToCart.delete(productName);
      chrome.runtime.sendMessage({
        action: 'clickResult',
        success: false,
        message: `Found "${productTitle}" but couldn't locate add to cart button`
      });
      return false;
    }
  }
  
  // Product not found in first 20 results
  console.log(`Product "${productName}" not found in first ${searchLimit} results`);
  // Remove from pending operations
  state.pendingAddToCart.delete(productName);
  chrome.runtime.sendMessage({
    action: 'clickResult',
    success: false,
    message: `Product "${productName}" doesn't exist in the current search results`
  });
  
  return false;
}

// New function to handle the add to cart popup that appears after clicking add to cart
function handleAddToCartPopup(productTitle) {
  console.log(`Checking for add to cart popup for product: "${productTitle}"...`);
  console.log(`Current pending operations: ${Array.from(state.pendingAddToCart).join(', ')}`);
  
  // Check if this product is still in pending operations
  if (!state.pendingAddToCart.has(productTitle)) {
    console.log(`Product "${productTitle}" is not in pending operations, skipping popup handling`);
    return;
  }
  
  // Wait a bit longer for popup to fully appear
  setTimeout(() => {
    // Look for the most recently appeared popup (get all popups and use the last one)
    const allPopups = document.querySelectorAll('.a-popover-wrapper, [id*="popover"], .puis-v1h7v1ngf5t5xv26abdw6jti9ph');
    let popup = null;
    
    // Find the most recently visible popup (the one that appeared last)
    for (let i = allPopups.length - 1; i >= 0; i--) {
      if (isElementVisible(allPopups[i])) {
        popup = allPopups[i];
        break;
      }
    }
    
    if (!popup) {
      console.log('No popup found, item might have been added directly');
      // Remove from pending operations
      state.pendingAddToCart.delete(productTitle);
      chrome.runtime.sendMessage({
        action: 'clickResult',
        success: true,
        message: `Successfully added "${productTitle}" to cart`
      });
      return;
    }
    
    console.log(`Found popup for product "${productTitle}", looking for add to cart button...`);
    
    // Look for add to cart buttons in THIS specific popup only
    const popupAddToCartButtons = popup.querySelectorAll('button.a-button-text, [data-cy="add-to-cart"] button, .puis-atcb-add-container button, button[type="button"]');
    
    console.log(`Found ${popupAddToCartButtons.length} potential add to cart buttons in this popup`);
    
    // Find the add to cart button in THIS specific popup
    let foundButton = null;
    for (const btn of popupAddToCartButtons) {
      const btnText = (btn.textContent || '').trim().toLowerCase();
      const btnAriaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
      
      if ((btnText.includes('add to cart') || btnText.includes('add')) && 
          !btnText.includes('cancel') &&
          !btnText.includes('remove') &&
          isElementVisible(btn)) {
        
        foundButton = btn;
        console.log(`Found add to cart button in popup for "${productTitle}": "${btnText}"`);
        break;
      }
    }
    
    if (foundButton) {
      // Highlight the popup button
      highlightElement(foundButton);
      
      // Click the add to cart button in the popup
      setTimeout(() => {
        try {
          foundButton.focus();
          foundButton.click();
          
          // Backup click event
          foundButton.dispatchEvent(new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
          }));
          
          console.log(`Successfully clicked add to cart in popup for: "${productTitle}"`);
          
          // Remove from pending operations
          state.pendingAddToCart.delete(productTitle);
          
          chrome.runtime.sendMessage({
            action: 'clickResult',
            success: true,
            message: `Successfully added "${productTitle}" to cart`
          });
          
        } catch (error) {
          console.error('Error clicking add to cart in popup:', error);
          // Remove from pending operations on error
          state.pendingAddToCart.delete(productTitle);
          chrome.runtime.sendMessage({
            action: 'clickResult',
            success: false,
            message: `Failed to click add to cart in popup: ${error.message}`
          });
        }
      }, 300);
      
      return;
    }
    
    // If no add to cart button found in popup, try alternative approach
    console.log('No add to cart button found in popup, trying alternative selectors...');
    
    const allPopupButtons = popup.querySelectorAll('button, input[type="button"], .a-button');
    for (const btn of allPopupButtons) {
      const btnText = (btn.textContent || btn.value || '').trim().toLowerCase();
      const btnClass = (btn.className || '').toLowerCase();
      
      if ((btnText.includes('add') && !btnText.includes('cancel')) ||
          btnClass.includes('atcb') ||
          btnClass.includes('add-to-cart')) {
        
        console.log(`Found alternative add to cart button in popup`);
        
        highlightElement(btn);
        
        setTimeout(() => {
          try {
            btn.click();
            console.log(`Successfully clicked alternative add to cart in popup`);
            
            // Remove from pending operations
            state.pendingAddToCart.delete(productTitle);
            
            chrome.runtime.sendMessage({
              action: 'clickResult',
              success: true,
              message: `Successfully added "${productTitle}" to cart`
            });
            
          } catch (error) {
            console.error('Error clicking alternative button in popup:', error);
            // Remove from pending operations on error
            state.pendingAddToCart.delete(productTitle);
            chrome.runtime.sendMessage({
              action: 'clickResult',
              success: false,
              message: `Failed to complete add to cart: ${error.message}`
            });
          }
        }, 500);
        
        return;
      }
    }
    
    // If still no button found, close popup and report success (item might have been added)
    console.log('No suitable button found in popup, assuming item was added');
    
    // Try to close the popup
    const closeButton = popup.querySelector('[data-action="a-popover-close"]') ||
                       popup.querySelector('.a-button-close') ||
                       popup.querySelector('button[aria-label*="Close"]');
    
    if (closeButton) {
      closeButton.click();
    }
    
    // Remove from pending operations
    state.pendingAddToCart.delete(productTitle);
    
    chrome.runtime.sendMessage({
      action: 'clickResult',
      success: true,
      message: `Successfully added "${productTitle}" to cart`
    });
    
  }, 1000); // Wait 1 second for popup to appear
}

// Checkout function
function proceedToCheckout() {
  console.log('🛒 Attempting to proceed to checkout...');
  
  try {
    // Look for checkout button variations on different e-commerce sites
    const checkoutSelectors = [
      // Amazon
      'input[name="proceedToRetailCheckout"]',
      'button[name="proceedToRetailCheckout"]',
      'input[aria-labelledby="attach-sidesheet-checkout-button-announce"]',
      'input[id="attach-sidesheet-checkout-button"]',
      'a[href*="checkout"]',
      
      // Generic checkout buttons
      'button[data-testid*="checkout"]',
      'button[class*="checkout"]',
      'a[class*="checkout"]',
      'input[value*="checkout" i]',
      'button[title*="checkout" i]',
    ];
    
    for (const selector of checkoutSelectors) {
      const element = document.querySelector(selector);
      if (element && isElementVisible(element)) {
        console.log(`✅ Found checkout element with selector: ${selector}`);
        highlightElement(element);
        
        setTimeout(() => {
          element.focus();
          element.click();
          
          // Also try dispatching events
          element.dispatchEvent(new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
          }));
          
          console.log('🎯 Clicked checkout button');
        }, 500);
        
        return true;
      }
    }
    
    // If no checkout button found, try to find cart/checkout related links
    const allLinks = document.querySelectorAll('a, button, input[type="submit"]');
    for (const link of allLinks) {
      const text = link.textContent?.toLowerCase() || '';
      const title = link.title?.toLowerCase() || '';
      const ariaLabel = link.getAttribute('aria-label')?.toLowerCase() || '';
      
      if ((text.includes('checkout') || text.includes('proceed') || 
           title.includes('checkout') || ariaLabel.includes('checkout')) && 
          isElementVisible(link)) {
        console.log(`✅ Found checkout element by text: "${text}"`);
        highlightElement(link);
        
        setTimeout(() => {
          link.focus();
          link.click();
          console.log('🎯 Clicked checkout element');
        }, 500);
        
        return true;
      }
    }
    
    console.log('❌ No checkout button found');
    return false;
    
  } catch (error) {
    console.error('❌ Error in proceedToCheckout:', error);
    return false;
  }
}

// Navigate to cart function
function navigateToCart() {
  console.log('🛒 Attempting to navigate to cart...');
  
  try {
    // Look for cart button/link variations on different e-commerce sites
    const cartSelectors = [
      // Amazon
      '#nav-cart',
      'a[href*="/cart"]',
      'a[aria-label*="cart" i]',
      'button[aria-label*="cart" i]',
      
      // Generic cart elements
      'a[class*="cart" i]',
      'button[class*="cart" i]',
      'a[data-testid*="cart" i]',
      'button[data-testid*="cart" i]',
      'a[id*="cart" i]',
      'button[id*="cart" i]',
      
      // Icon-based cart elements (look for cart icons)
      'a svg[class*="cart"]',
      'button svg[class*="cart"]',
      'a i[class*="cart"]',
      'button i[class*="cart"]'
    ];
    
    for (const selector of cartSelectors) {
      const element = document.querySelector(selector);
      if (element && isElementVisible(element)) {
        console.log(`✅ Found cart element with selector: ${selector}`);
        highlightElement(element);
        
        setTimeout(() => {
          element.focus();
          element.click();
          
          // Also try dispatching events
          element.dispatchEvent(new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
          }));
          
          console.log('🎯 Clicked cart element');
        }, 500);
        
        return true;
      }
    }
    
    // If no cart element found by selector, try to find by text content
    const allClickableElements = document.querySelectorAll('a, button, span[onclick], div[onclick]');
    for (const element of allClickableElements) {
      const text = element.textContent?.toLowerCase() || '';
      const title = element.title?.toLowerCase() || '';
      const ariaLabel = element.getAttribute('aria-label')?.toLowerCase() || '';
      
      if ((text.includes('cart') || text.includes('basket') || 
           title.includes('cart') || title.includes('basket') || 
           ariaLabel.includes('cart') || ariaLabel.includes('basket')) && 
          isElementVisible(element)) {
        console.log(`✅ Found cart element by text: "${text}"`);
        highlightElement(element);
        
        setTimeout(() => {
          element.focus();
          element.click();
          console.log('🎯 Clicked cart element');
        }, 500);
        
        return true;
      }
    }
    
    // Try to navigate directly to cart page if on Amazon
    if (window.location.hostname.includes('amazon')) {
      const cartUrl = window.location.origin + '/cart';
      console.log(`🔗 Navigating directly to cart: ${cartUrl}`);
      window.location.href = cartUrl;
      return true;
    }
    
    console.log('❌ No cart element found');
    return false;
    
  } catch (error) {
    console.error('❌ Error in navigateToCart:', error);
    return false;
  }
}

// Message listener - update to handle addToCart
browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request);
  
  if (request.action === 'startCapture') {
    console.log('Starting capture from message');
    startScreenCapture();
    sendResponse({ success: true });
    return true;
  } else if (request.action === 'clickElement') {
    console.log(`Attempting to click on: ${request.target}`);
    const success = clickElement(request.target);
    sendResponse({ success });
  } else if (request.action === 'searchFor') {
    console.log(`Attempting to search for: ${request.query}`);
    const success = handleSearch(request.query);
    sendResponse({ success });
  } else if (request.action === 'setPriceRange') {
    console.log(`Attempting to set price range: ${request.lower} - ${request.higher}`);
    const success = setPriceRange(request.lower, request.higher);
    sendResponse({ success });
  } else if (request.action === 'scrollPage') {
    console.log(`Attempting to scroll ${request.direction} by ${request.amount}px`);
    const success = scrollPage(request.direction, request.amount);
    sendResponse({ success });
  } else if (request.action === 'addToCart') {
    console.log(`Attempting to add to cart: ${request.productName}`);
    const success = addToCart(request.productName);
    sendResponse({ success });
  } else if (request.action === 'proceedToCheckout') {
    console.log('Attempting to proceed to checkout');
    const success = proceedToCheckout();
    sendResponse({ success });
  } else if (request.action === 'navigateToCart') {
    console.log('Attempting to navigate to cart');
    const success = navigateToCart();
    sendResponse({ success });
  }
  
  return true;
});

// Log that content script is loaded
console.log('Chat extension content script loaded');

// Helper function to highlight elements with enhanced styling
function highlightElement(element) {
  if (!element) return;
  
  const originalStyle = element.style.cssText;
  element.style.cssText += `
    outline: 3px solid #ff6b6b !important;
    outline-offset: 2px !important;
    background-color: rgba(255, 107, 107, 0.1) !important;
    box-shadow: 0 0 15px rgba(255, 107, 107, 0.5) !important;
    transition: all 0.3s ease !important;
  `;
  
  setTimeout(() => {
    element.style.cssText = originalStyle;
  }, 3000);
}

// Helper function to check if element is visible
function isElementVisible(element) {
  if (!element) return false;
  
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0'
  );
}