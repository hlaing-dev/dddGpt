import React, { useState, useEffect } from 'react';
import "./App.css";
import ChatForm from "./components/ChatForm";
import Header from "./components/Header";
import AnswerSec from "./components/Answers";
import OpenAI from "openai";
import ApiKeyConfig from "./components/ApiKeyConfig";

const App = () => {
  const [messages, setMessages] = useState([]);
  const [apiKey, setApiKey] = useState('');
  const [isValid, setIsValid] = useState(false);
  const [loading, setLoading] = useState(true); // Added loading state

  useEffect(() => {
    const savedApiKey = localStorage.getItem('apiKey');
    if (savedApiKey) {
      setApiKey(savedApiKey);
      testApiKey(savedApiKey);
    }
  }, []);

  const handleSaveApiKey = (apiKey) => {
    console.log('apiKey is=>', apiKey);
    setApiKey(apiKey);
  };

  const testApiKey = async (apiKey) => {
    try {
      setLoading(true); // Set loading to true before starting the request
      const openai = new OpenAI({
        apiKey: apiKey,
        headers: {
          Authorization: `Bearer ${apiKey}`
        },
        dangerouslyAllowBrowser: true
      });
      await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{"role": "user", "content": "test"}],
      });
      setIsValid(true);
      setLoading(false); // Set loading to false after the request completes
      return true;
    } catch(err) {
      setIsValid(false);
      setLoading(false); // Set loading to false in case of an error
      return false;
    }
  };
  
  const responseGenerate = async (inputText, tmpApiKey = '') => {
    try {
      setLoading(true); // Set loading to true before starting the request
      const openai = new OpenAI({
        apiKey: apiKey || tmpApiKey,
        headers: {
          Authorization: `Bearer ${apiKey || tmpApiKey}`
        },
        dangerouslyAllowBrowser: true
      });
      const chatCompletion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{"role": "user", "content": inputText}],
      });
      if (chatCompletion.choices && !tmpApiKey) {
        setMessages([
          {
            question: inputText,
            answer: chatCompletion.choices[0].message.content,
          },
          ...messages,
        ]);
      }
      setIsValid(true);
      setLoading(false); // Set loading to false after the request completes
    } catch(err) {
      setIsValid(false);
      setLoading(false); // Set loading to false in case of an error
      alert(err);
    }
  };
  

  return (
    <div className="container">
      {isValid && <Header />}
      {!isValid && <ApiKeyConfig onSave={handleSaveApiKey} responseGenerate={responseGenerate} testApiKey={testApiKey} isValid={isValid} />}
      {isValid && (
        <>
          <AnswerSec messages={messages} />
          <ChatForm responseGenerate={responseGenerate} loading={loading}/>
        </>
      )}
    </div>
  );
};

export default App;
