import React, { useState } from "react";

const ChatInput = ({ responseGenerate, loading }) => {
  const [inputText, setInputText] = useState("");

  const createSpanMap = (word) => {
    let spanMap = '';
    for (let i = 0; i < word.length; i++) {
        spanMap += `<span>${word[i]}</span>`;
        // Add space after each letter except the last one
        if (i < word.length - 1) {
            spanMap += ' ';
        }
    }
    return spanMap;
  }

  const handleButtonClick = () => {
    responseGenerate(inputText);
    setInputText("");
  };

  console.log("loading is=>", loading);
  return (
    <div className="chat-input-container">
      {loading && <div className="loading loading03" dangerouslySetInnerHTML={{__html: createSpanMap("Loading...")}}></div>}
      <textarea
        rows="5"
        className="form-control"
        placeholder="Ask me anything..."
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
      ></textarea>
      <br />
      <button onClick={handleButtonClick} className="form-btn">
        Ask
      </button>
    </div>
  );
};

export default ChatInput;
