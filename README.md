# WebSocket Chat Application

A real-time chat application built with React (frontend) and Node.js + WebSocket (backend).

## 🚀 Features

- **Real-time messaging** with WebSocket connections
- **User presence** - see who's online
- **Typing indicators** - see when someone is typing
- **Message history** - loads previous messages on join
- **Responsive design** - works on desktop and mobile
- **Auto-reconnection** - automatically reconnects if connection is lost
- **System notifications** - join/leave messages
- **Modern UI** - gradient design with smooth animations

## 📁 Project Structure

```
Chat App/
├── server/
│   ├── package.json
│   └── server.js
└── client/
    ├── public/
    │   └── index.html
    ├── src/
    │   ├── App.jsx
    │   ├── App.css
    │   ├── index.jsx
    │   └── index.css
    └── package.json
```

## 🛠️ Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### 1. Install Server Dependencies
```cmd
cd "d:\Webstrome\Coding Questions\Chat App\server"
npm install
```

### 2. Install Client Dependencies
```cmd
cd "d:\Webstrome\Coding Questions\Chat App\client"
npm install
```

## 🎯 Running the Application

### 1. Start the Server (Terminal 1)
```cmd
cd "d:\Webstrome\Coding Questions\Chat App\server"
npm start
```
Server will run on http://localhost:3001

### 2. Start the Client (Terminal 2)
```cmd
cd "d:\Webstrome\Coding Questions\Chat App\client"
npm start
```
Client will run on http://localhost:3000

## 🔧 API Endpoints

- **WebSocket**: `ws://localhost:3001` - Main chat connection
- **REST Health Check**: `GET /api/health` - Server status
- **REST Messages**: `GET /api/messages?limit=50` - Get message history

## 📱 Usage

1. Open http://localhost:3000 in your browser
2. Enter a username to join the chat
3. Start chatting in real-time!
4. Open multiple browser tabs to test with different users

## 🌟 WebSocket Message Types

### Client → Server
- `join` - Join chat with username
- `message` - Send chat message
- `typing` - Typing indicator

### Server → Client
- `message_history` - Load previous messages
- `new_message` - New chat message
- `user_joined` - User joined notification
- `user_left` - User left notification
- `users_list` - Current online users
- `typing` - Typing indicator from other users

## 🚧 Current Limitations

- **In-memory storage** - messages are lost on server restart
- **No authentication** - basic demo tokens only
- **No persistence** - no database integration
- **No message history API** - limited to WebSocket delivery
- **No advanced features** - no read receipts, file sharing, etc.

## 🔮 Possible Next Steps

1. **JWT Authentication + Password Hashing**
   - Replace demo tokens with proper JWT authentication
   - Add bcrypt password hashing
   - User registration/login system

2. **SQLite Database Persistence**
   - Store messages, users, and chat history
   - Persistent user accounts
   - Message search functionality

3. **Message History REST Endpoint**
   - Paginated message history API
   - Load older messages on scroll
   - Message filtering and search

4. **Advanced Chat Features**
   - User presence indicators
   - Read receipts
   - Typing indicators improvements
   - File/image sharing
   - Private messaging
   - Chat rooms/channels

5. **Production Ready Features**
   - Rate limiting
   - Message validation
   - Error handling improvements
   - Logging and monitoring
   - Docker containerization
   - Environment configuration

## 🐛 Development

For development with auto-restart:
```cmd
# Server with nodemon
cd server
npm run dev

# Client (already has hot reload)
cd client
npm start
```

## 📦 Dependencies

### Server
- **express** - Web framework
- **ws** - WebSocket library
- **cors** - CORS middleware
- **uuid** - Unique ID generation

### Client
- **react** - Frontend framework
- **react-dom** - React DOM renderer
- **react-scripts** - Create React App tooling