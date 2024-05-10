import React from "react";

const AnswerSec = ({ messages }) => {
  // Create a copy of the messages array and reverse it
  const reversedMessages = messages.slice().reverse();

  return (
    <div className="chat-container">
      {reversedMessages && reversedMessages.length > 0 && (
        <div className="chat">
          {reversedMessages.map((message, index) => (
            <div key={index} className="message">
              <p className="question">{message.question}</p>
              <div className="answer">
                {message.answer.split('\n').map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AnswerSec;