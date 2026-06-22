# Chat App - Premium Real-Time Messenger

A premium, state-of-the-art real-time messaging application built with a modern stack featuring instant message delivery, online presence tracking, secure authentication, and a responsive workspace layout.

---

## 🚀 Technology Stack & Frameworks

This application is built on a full-stack Javascript architecture:

### 1. Front-End (`client/`)
* **Framework**: [React.js](https://reactjs.org/) (v18.2)
* **Routing**: [React Router](https://reactrouter.com/) (v6.8) for route management and path protection.
* **Styling**: [TailwindCSS](https://tailwindcss.com/) (v3.2) utilizing custom design systems (colors like `primary`, `secondary`, `light`).
* **Real-time Client**: [Socket.io Client](https://socket.io/) (v4.6) for instant, bi-directional event communications.

### 2. Back-End (`server/`)
* **Runtime**: [Node.js](https://nodejs.org/)
* **Web Framework**: [Express](https://expressjs.com/) (v4.18) for RESTful API routing.
* **WebSocket Server**: [Socket.io](https://socket.io/) (v4.6) handling client socket handshakes, online status rooms, and message broadcasts.
* **Security & Tokens**: [JSON Web Tokens (JWT)](https://jwt.io/) for session tokens and [BcryptJS](https://github.com/dcodeIO/bcrypt.js) for password hashing.

---

## 🗄️ Database Architecture

The application uses **MongoDB** as its primary data store, managed through the **Mongoose** (v7.0) ODM.

### Storage Locations
1. **Cloud Database (MongoDB Atlas)**: If environment variables `DB_USERNAME` and `DB_PASSWORD` are configured, the server will connect to MongoDB Atlas cluster for production storage.
2. **Local Fallback**: If Atlas environment variables are absent, the application automatically falls back to a local MongoDB server instance running at:
   ```
   mongodb://127.0.0.1:27017/chat-app
   ```

### Database Schemas (Data Models)
* **`User`** (`models/Users.js`):
  * `fullName` (String, required)
  * `email` (String, required, unique)
  * `password` (String, required, hashed via bcrypt)
  * `token` (String, JWT session authentication token)
* **`Conversation`** (`models/Conversations.js`):
  * `members` (Array, user IDs involved in the dialogue)
* **`Message`** (`models/Messages.js`):
  * `conversationId` (String, linked to conversation)
  * `senderId` (String, sending user's ID)
  * `message` (String, raw text payload of the message)

---

## 📦 Core Libraries Used

### Back-End:
* `express` - HTTP framework
* `socket.io` - WebSocket server
* `mongoose` - Database ODM
* `bcryptjs` - Password cryptography
* `jsonwebtoken` - User identity tokens
* `cors` - Cross-Origin Resource Sharing handling
* `nodemon` - Hot reloading during development

### Front-End:
* `react` / `react-dom` - Component rendering library
* `react-router-dom` - Page navigation & routing
* `socket.io-client` - WebSocket client connection
* `tailwindcss` - CSS utility styling framework

---

## 🔧 Installation & Getting Started

### 1. Database Setup
Make sure you have MongoDB running locally (on default port `27017`) or configure the environment variables:
```env
DB_USERNAME=your_atlas_username
DB_PASSWORD=your_atlas_password
JWT_SECRET_KEY=your_jwt_secret_key
```

### 2. Back-End Server Startup
Open a terminal in the `server` directory and run:
```bash
# Install dependencies
npm install

# Start backend server in development mode
npm run dev
```
The server will run on `http://localhost:8000` and the Socket.io gateway will run on `http://localhost:8080`.

### 3. Front-End Client Startup
Open another terminal in the `client` directory and run:
```bash
# Install dependencies
npm install

# Start React development server
npm start
```
The application will boot on `http://localhost:3000`.

