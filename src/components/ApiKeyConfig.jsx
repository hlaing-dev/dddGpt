import React, { useState } from 'react';

const ApiKeyConfig = ({ onSave, responseGenerate, testApiKey, isValid }) => {
  const [tempApiKey, setTempApiKey] = useState('');
  const [error, setError] = useState('');

  console.log('isValid is=>', isValid);
  const handleApiKeyChange = (event) => {
    setTempApiKey(event.target.value);
    // Clear error message when user starts typing
    setError('');
  };

  const handleSaveAndContinue = () => {
    // Test the API key
    testApiKey(tempApiKey)
      .then((valid) => {
        console.log('valid is=>', valid);
        if (valid) {
          // API key is valid, save it
          localStorage.setItem('apiKey', tempApiKey);
          onSave(tempApiKey);
        } else {
          // API key is not valid, display error
          setError('API Key is not valid.');
        }
      })
      .catch((error) => {
        // Handle error
        console.error('Error testing API key:', error);
        setError('Error testing API key.');
      });
  };

  return (
    <div className="api-key-container">
      <label htmlFor="apiKey">Enter your OpenAI API key:</label>
      <input
        type="password"
        id="apiKey"
        value={tempApiKey}
        onChange={handleApiKeyChange}
        placeholder="Your API key"
      />
      <button onClick={handleSaveAndContinue}>Save & Continue</button>
      {error && (
        <p className="error-message">{error}</p>
      )}
      {isValid && (
        <p className="valid-message">API Key is valid.</p>
      )}
    </div>
  );
};

export default ApiKeyConfig;
