const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Store connected clients and messages
const clients = new Map();
const messages = [];

// WebSocket connection handler
wss.on('connection', (ws) => {
  const clientId = uuidv4();
  const clientInfo = {
    id: clientId,
    ws: ws,
    username: null,
    joinedAt: new Date()
  };
  
  clients.set(clientId, clientInfo);
  console.log(`Client ${clientId} connected. Total clients: ${clients.size}`);

  // Send existing messages to new client
  ws.send(JSON.stringify({
    type: 'message_history',
    messages: messages.slice(-50) // Send last 50 messages
  }));

  // Handle incoming messages
  ws.on('message', (data) => {
    try {
      const parsedData = JSON.parse(data.toString());
      
      switch (parsedData.type) {
        case 'join':
          handleUserJoin(clientId, parsedData.username);
          break;
        case 'message':
          handleMessage(clientId, parsedData.content);
          break;
        case 'typing':
          handleTyping(clientId, parsedData.isTyping);
          break;
        case 'voice_call_offer':
          handleVoiceCallOffer(clientId, parsedData.targetUser, parsedData.offer);
          break;
        case 'voice_call_answer':
          handleVoiceCallAnswer(clientId, parsedData.targetUser, parsedData.answer);
          break;
        case 'voice_call_ice_candidate':
          handleVoiceCallIceCandidate(clientId, parsedData.targetUser, parsedData.candidate);
          break;
        case 'voice_call_end':
          handleVoiceCallEnd(clientId, parsedData.targetUser);
          break;
        default:
          console.log('Unknown message type:', parsedData.type);
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });

  // Handle client disconnect
  ws.on('close', () => {
    const client = clients.get(clientId);
    if (client && client.username) {
      // Check if this user has other active connections
      const otherConnections = Array.from(clients.values())
        .filter(c => c.id !== clientId && c.username && c.username.toLowerCase() === client.username.toLowerCase());
      
      // Only send leave message if no other connections exist
      if (otherConnections.length === 0) {
        broadcastToAll({
          type: 'user_left',
          username: client.username,
          timestamp: new Date().toISOString()
        });
      }
    }
    clients.delete(clientId);
    console.log(`Client ${clientId} disconnected. Total clients: ${clients.size}`);
    
    // Update users list for remaining clients
    broadcastUsersList();
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error(`WebSocket error for client ${clientId}:`, error);
  });
});

function handleUserJoin(clientId, username) {
  const client = clients.get(clientId);
  if (!client) return;

  // Check if user is already online (prevent duplicates)
  const existingUser = Array.from(clients.values())
    .find(c => c.username && c.username.toLowerCase() === username.toLowerCase() && c.id !== clientId);
  
  if (existingUser) {
    // Remove the old connection
    clients.delete(existingUser.id);
    if (existingUser.ws.readyState === 1) {
      existingUser.ws.close();
    }
  }

  const wasAlreadyOnline = Array.from(clients.values())
    .some(c => c.username && c.username.toLowerCase() === username.toLowerCase());

  client.username = username;
  
  // Only notify about new user if they weren't already online
  if (!wasAlreadyOnline) {
    broadcastToAll({
      type: 'user_joined',
      username: username,
      timestamp: new Date().toISOString()
    });
  }

  // Send current users list to all clients (updated list)
  broadcastUsersList();
}

function broadcastUsersList() {
  const usersList = Array.from(clients.values())
    .filter(c => c.username)
    .map(c => c.username)
    .filter((username, index, arr) => arr.indexOf(username) === index); // Remove duplicates
  
  broadcastToAll({
    type: 'users_list',
    users: usersList
  });
}

function handleMessage(clientId, content) {
  const client = clients.get(clientId);
  if (!client || !client.username) return;

  const message = {
    id: uuidv4(),
    username: client.username,
    content: content,
    timestamp: new Date().toISOString()
  };

  messages.push(message);
  
  // Keep only last 1000 messages in memory
  if (messages.length > 1000) {
    messages.splice(0, messages.length - 1000);
  }

  // Broadcast message to all clients
  broadcastToAll({
    type: 'new_message',
    message: message
  });
}

function handleTyping(clientId, isTyping) {
  const client = clients.get(clientId);
  if (!client || !client.username) return;

  broadcastToOthers(clientId, {
    type: 'typing',
    username: client.username,
    isTyping: isTyping
  });
}

function broadcastToAll(data) {
  const message = JSON.stringify(data);
  clients.forEach((client) => {
    if (client.ws.readyState === 1) { // WebSocket.OPEN
      client.ws.send(message);
    }
  });
}

function broadcastToOthers(excludeClientId, data) {
  const message = JSON.stringify(data);
  clients.forEach((client, clientId) => {
    if (clientId !== excludeClientId && client.ws.readyState === 1) {
      client.ws.send(message);
    }
  });
}

function handleVoiceCallOffer(clientId, targetUser, offer) {
  const client = clients.get(clientId);
  if (!client || !client.username) return;

  // Find target user
  const targetClient = Array.from(clients.values()).find(c => c.username === targetUser);
  if (targetClient && targetClient.ws.readyState === 1) {
    targetClient.ws.send(JSON.stringify({
      type: 'voice_call_offer',
      fromUser: client.username,
      offer: offer
    }));
  }
}

function handleVoiceCallAnswer(clientId, targetUser, answer) {
  const client = clients.get(clientId);
  if (!client || !client.username) return;

  // Find target user
  const targetClient = Array.from(clients.values()).find(c => c.username === targetUser);
  if (targetClient && targetClient.ws.readyState === 1) {
    targetClient.ws.send(JSON.stringify({
      type: 'voice_call_answer',
      fromUser: client.username,
      answer: answer
    }));
  }
}

function handleVoiceCallIceCandidate(clientId, targetUser, candidate) {
  const client = clients.get(clientId);
  if (!client || !client.username) return;

  // Find target user
  const targetClient = Array.from(clients.values()).find(c => c.username === targetUser);
  if (targetClient && targetClient.ws.readyState === 1) {
    targetClient.ws.send(JSON.stringify({
      type: 'voice_call_ice_candidate',
      fromUser: client.username,
      candidate: candidate
    }));
  }
}

function handleVoiceCallEnd(clientId, targetUser) {
  const client = clients.get(clientId);
  if (!client || !client.username) return;

  // Find target user
  const targetClient = Array.from(clients.values()).find(c => c.username === targetUser);
  if (targetClient && targetClient.ws.readyState === 1) {
    targetClient.ws.send(JSON.stringify({
      type: 'voice_call_end',
      fromUser: client.username
    }));
  }
}

// REST API endpoints
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    connectedClients: clients.size,
    messagesInMemory: messages.length,
    uptime: process.uptime()
  });
});

app.get('/api/messages', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  res.json({
    messages: messages.slice(-limit)
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`🚀 Chat server running on port ${PORT}`);
  console.log(`📡 WebSocket server ready for connections`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  wss.clients.forEach((ws) => {
    ws.close();
  });
  server.close(() => {
    console.log('✅ Server shut down successfully');
    process.exit(0);
  });
});