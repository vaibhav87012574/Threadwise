import React from 'react';
import { IMAGE_MAX_WIDTH } from '../utils/constants.js';

const ImagePreview = ({ selectedImage, onRemove }) => {
  console.log('ImagePreview render:', { selectedImage, hasOnRemove: !!onRemove });
  
  if (!selectedImage) {
    console.log('ImagePreview: No selected image, returning null');
    return null;
  }

  if (!selectedImage.data) {
    console.log('ImagePreview: Image data missing, returning null');
    return null;
  }

  console.log('ImagePreview: Rendering with image:', selectedImage.name || 'unnamed');

  return (
    <div className="image-preview-container" style={{
      position: 'relative',
      marginBottom: '10px',
      padding: '10px',
      backgroundColor: '#f8f9fa',
      borderRadius: '8px',
      border: '1px solid #e9ecef',
      display: 'block', // Ensure it's visible
      visibility: 'visible' // Ensure it's visible
    }}>
      <img 
        src={selectedImage.data} 
        alt="Preview" 
        className="image-preview"
        style={{
          maxWidth: IMAGE_MAX_WIDTH || '300px',
          maxHeight: '200px',
          borderRadius: '6px',
          display: 'block',
          objectFit: 'contain',
          margin: '0 auto'
        }}
        onError={(e) => {
          console.error('Image preview failed to load:', e);
        }}
        onLoad={() => {
          console.log('Image preview loaded successfully');
        }}
      />
      <button 
        onClick={onRemove} 
        className="remove-image"
        style={{
          position: 'absolute',
          top: '5px',
          right: '5px',
          background: '#dc3545',
          color: 'white',
          border: 'none',
          borderRadius: '50%',
          width: '25px',
          height: '25px',
          cursor: 'pointer',
          fontSize: '16px',
          lineHeight: '1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        title="Remove image"
      >
        ×
      </button>
      {selectedImage.name && (
        <p style={{
          fontSize: '12px',
          color: '#6c757d',
          margin: '5px 0 0 0',
          textAlign: 'center'
        }}>
          {selectedImage.name}
        </p>
      )}
    </div>
  );
};

export default ImagePreview;
