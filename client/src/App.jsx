import React, { useState, useEffect, useRef } from 'react';
import './App.css';

const App = () => {
  const [ws, setWs] = useState(null);
  const [connected, setConnected] = useState(false);
  const [username, setUsername] = useState('');
  const [currentUser, setCurrentUser] = useState('');
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [users, setUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [voiceCall, setVoiceCall] = useState({
    active: false,
    caller: null,
    receiver: null,
    incoming: false
  });
  
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const messageInputRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const connectWebSocket = () => {
    // Close existing connection if any
    if (ws) {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    }

    const websocket = new WebSocket('wss://chat-app-nzoi.onrender.com');
    
    websocket.onopen = () => {
      console.log('Connected to WebSocket server');
      setConnected(true);
      setWs(websocket);
    };

    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    websocket.onclose = (event) => {
      console.log('Disconnected from WebSocket server', event.code, event.reason);
      setConnected(false);
      setWs(null);
      
      // Only attempt to reconnect if it wasn't a manual close and user is logged in
      if (event.code !== 1000 && currentUser) {
        setTimeout(() => {
          if (!connected) {
            connectWebSocket();
          }
        }, 3000);
      }
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  };

  const handleWebSocketMessage = (data) => {
    switch (data.type) {
      case 'message_history':
        setMessages(data.messages || []);
        break;
      case 'new_message':
        setMessages(prev => [...prev, data.message]);
        break;
      case 'user_joined':
        addSystemMessage(`${data.username} joined the chat`);
        break;
      case 'user_left':
        addSystemMessage(`${data.username} left the chat`);
        break;
      case 'users_list':
        setUsers(data.users || []);
        break;
      case 'typing':
        handleTypingIndicator(data.username, data.isTyping);
        break;
      case 'voice_call_offer':
        handleIncomingCall(data.fromUser, data.offer);
        break;
      case 'voice_call_answer':
        handleCallAnswer(data.answer);
        break;
      case 'voice_call_ice_candidate':
        handleIceCandidate(data.candidate);
        break;
      case 'voice_call_end':
        handleCallEnd();
        break;
      default:
        console.log('Unknown message type:', data.type);
    }
  };

  const addSystemMessage = (content) => {
    // Prevent duplicate system messages
    setMessages(prev => {
      const lastMessage = prev[prev.length - 1];
      if (lastMessage && lastMessage.isSystem && lastMessage.content === content) {
        return prev; // Don't add duplicate system message
      }
      
      const systemMessage = {
        id: Date.now() + Math.random(), // Ensure unique ID
        username: 'System',
        content: content,
        timestamp: new Date().toISOString(),
        isSystem: true
      };
      return [...prev, systemMessage];
    });
  };

  const handleTypingIndicator = (username, isTyping) => {
    setTypingUsers(prev => {
      if (isTyping) {
        return prev.includes(username) ? prev : [...prev, username];
      } else {
        return prev.filter(user => user !== username);
      }
    });
  };

  const joinChat = (e) => {
    e.preventDefault();
    if (username.trim() && ws && connected && !currentUser) {
      const trimmedUsername = username.trim();
      setCurrentUser(trimmedUsername);
      ws.send(JSON.stringify({
        type: 'join',
        username: trimmedUsername
      }));
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (newMessage.trim() && ws && connected) {
      ws.send(JSON.stringify({
        type: 'message',
        content: newMessage.trim()
      }));
      setNewMessage('');
      stopTyping();
    }
  };

  const handleMessageInputChange = (e) => {
    setNewMessage(e.target.value);
    
    if (!isTyping && e.target.value.trim()) {
      startTyping();
    } else if (isTyping && !e.target.value.trim()) {
      stopTyping();
    }
  };

  const startTyping = () => {
    if (ws && connected && currentUser) {
      setIsTyping(true);
      ws.send(JSON.stringify({
        type: 'typing',
        isTyping: true
      }));
      
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Stop typing after 2 seconds of no input
      typingTimeoutRef.current = setTimeout(() => {
        stopTyping();
      }, 2000);
    }
  };

  const stopTyping = () => {
    if (isTyping && ws && connected) {
      setIsTyping(false);
      ws.send(JSON.stringify({
        type: 'typing',
        isTyping: false
      }));
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const startVoiceCall = async (targetUser) => {
    if (!ws || !connected) return;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      
      const peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      peerConnectionRef.current = peerConnection;
      
      stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream);
      });
      
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          ws.send(JSON.stringify({
            type: 'voice_call_ice_candidate',
            targetUser: targetUser,
            candidate: event.candidate
          }));
        }
      };
      
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      
      ws.send(JSON.stringify({
        type: 'voice_call_offer',
        targetUser: targetUser,
        offer: offer
      }));
      
      setVoiceCall({ active: true, caller: currentUser, receiver: targetUser, incoming: false });
    } catch (error) {
      console.error('Error starting voice call:', error);
      alert('Could not access microphone');
    }
  };

  const handleIncomingCall = async (caller, offer) => {
    setVoiceCall({ active: true, caller: caller, receiver: currentUser, incoming: true });
    
    if (window.confirm(`${caller} is calling you. Accept?`)) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = stream;
        
        const peerConnection = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });
        peerConnectionRef.current = peerConnection;
        
        stream.getTracks().forEach(track => {
          peerConnection.addTrack(track, stream);
        });
        
        peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            ws.send(JSON.stringify({
              type: 'voice_call_ice_candidate',
              targetUser: caller,
              candidate: event.candidate
            }));
          }
        };
        
        await peerConnection.setRemoteDescription(offer);
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        ws.send(JSON.stringify({
          type: 'voice_call_answer',
          targetUser: caller,
          answer: answer
        }));
        
        setVoiceCall({ active: true, caller: caller, receiver: currentUser, incoming: false });
      } catch (error) {
        console.error('Error answering call:', error);
        endVoiceCall();
      }
    } else {
      endVoiceCall();
    }
  };

  const handleCallAnswer = async (answer) => {
    if (peerConnectionRef.current) {
      await peerConnectionRef.current.setRemoteDescription(answer);
    }
  };

  const handleIceCandidate = async (candidate) => {
    if (peerConnectionRef.current) {
      await peerConnectionRef.current.addIceCandidate(candidate);
    }
  };

  const handleCallEnd = () => {
    endVoiceCall();
  };

  const endVoiceCall = () => {
    if (voiceCall.active) {
      ws.send(JSON.stringify({
        type: 'voice_call_end',
        targetUser: voiceCall.caller === currentUser ? voiceCall.receiver : voiceCall.caller
      }));
    }
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    setVoiceCall({ active: false, caller: null, receiver: null, incoming: false });
  };

  if (!currentUser) {
    return (
      <div className="login-container">
        <div className="login-box">
          <h1>🚀 WebSocket Chat</h1>
          <form onSubmit={joinChat}>
            <input
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={20}
              required
            />
            <button type="submit" disabled={!connected || !username.trim()}>
              {connected ? 'Join Chat' : 'Connecting...'}
            </button>
          </form>
          <div className="connection-status">
            <span className={`status-indicator ${connected ? 'connected' : 'disconnected'}`}>
              {connected ? '🟢 Connected' : '🔴 Disconnected'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-app">
      <div className="chat-header">
        <h1>💬 Chat Room</h1>
        <div className="header-info">
          <span className="current-user">👤 {currentUser}</span>
          <span className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
            {connected ? '🟢 Connected' : '🔴 Disconnected'}
          </span>
        </div>
      </div>

      {voiceCall.active && (
        <div className="voice-call-overlay">
          <div className="voice-call-info">
            <h3>🔊 Voice Call</h3>
            <p>{voiceCall.caller === currentUser ? `Calling ${voiceCall.receiver}...` : `In call with ${voiceCall.caller}`}</p>
            <button className="end-call-btn" onClick={endVoiceCall}>
              📞 End Call
            </button>
          </div>
        </div>
      )}

      <div className="chat-container">
        <div className="chat-main">
          <div className="messages-container">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`message ${message.isSystem ? 'system-message' : ''} ${
                  message.username === currentUser ? 'own-message' : ''
                }`}
              >
                {!message.isSystem && (
                  <div className="message-header">
                    <span className="username">{message.username}</span>
                    <span className="timestamp">{formatTimestamp(message.timestamp)}</span>
                  </div>
                )}
                <div className="message-content">{message.content}</div>
              </div>
            ))}
            
            {typingUsers.length > 0 && (
              <div className="typing-indicator">
                <span>💬 {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...</span>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          <form className="message-input-container" onSubmit={sendMessage}>
            <input
              ref={messageInputRef}
              type="text"
              placeholder="Type a message..."
              value={newMessage}
              onChange={handleMessageInputChange}
              maxLength={500}
              disabled={!connected}
            />
            <button type="submit" disabled={!connected || !newMessage.trim()}>
              Send
            </button>
          </form>
        </div>

        <div className="users-sidebar">
          <h3>👥 Online Users ({users.length})</h3>
          <div className="users-list">
            {users.map((user, index) => (
              <div key={index} className={`user-item ${user === currentUser ? 'current-user' : ''}`}>
                <span className="user-status">🟢</span>
                <span className="user-name">{user}</span>
                {user === currentUser && <span className="you-label">(you)</span>}
                {user !== currentUser && (
                  <button 
                    className="voice-call-btn"
                    onClick={() => startVoiceCall(user)}
                    disabled={voiceCall.active}
                    title="Start voice call"
                  >
                    📞
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;