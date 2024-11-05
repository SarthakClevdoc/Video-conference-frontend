import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './polyfills';
// ... rest of your imports
// ... rest of your imports

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);