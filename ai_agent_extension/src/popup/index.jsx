import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

console.log('Chat popup loaded');

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', function() {
  const container = document.getElementById('root');
  const root = createRoot(container);
  
  root.render(<App />);
});
