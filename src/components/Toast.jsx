import React from 'react';

export default function Toast({ message, isError, visible }) {
  return (
    <div id="toast" className={`${visible ? 'show' : ''} ${isError ? 'error' : ''}`}>
      {message}
    </div>
  );
}
