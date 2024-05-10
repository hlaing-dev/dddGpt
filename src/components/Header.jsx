import React from "react";

const Header = ({ onQuit }) => {
  const handleQuit = () => {
    localStorage.clear();
    window.location.reload();
  };

  return (
    <div className="header">
      <h1 className="title">dddGPT</h1>
      <button className="quit-button" onClick={handleQuit}>Quit</button>
    </div>
  );
};

export default Header;
