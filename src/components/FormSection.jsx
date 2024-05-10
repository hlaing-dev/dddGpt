import React from 'react';

const ChatForm = () => {
  return (
    <div className="formDiv">
      <textarea
        rows="5"
        className="formControl"
        placeholder="Ask me anything..."
      ></textarea>
      <button className="formBtn">
        Ask
      </button>
    </div>
  );
};

export default ChatForm;