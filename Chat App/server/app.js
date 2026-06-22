require('dotenv').config();
const express = require('express');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const io = require('socket.io')(8080, {
    cors: {
        origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'],
    }
});

// Connect DB
require('./db/connection');

// Import Files
const Users = require('./models/Users');
const Conversations = require('./models/Conversations');
const Messages = require('./models/Messages');

// app Use
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());

const port = process.env.PORT || 8000;

// Socket.io JWT Middleware
io.use((socket, next) => {
    try {
        const token = socket.handshake.auth.token || socket.handshake.headers['authorization'];
        if (!token) {
            return next(new Error('Authentication error: Token missing'));
        }
        
        const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'THIS_IS_A_JWT_SECRET_KEY';
        jwt.verify(token, JWT_SECRET_KEY, (err, decoded) => {
            if (err) {
                return next(new Error('Authentication error: Invalid or expired token'));
            }
            socket.user = decoded;
            next();
        });
    } catch (error) {
        console.error('Socket Auth Middleware Error:', error);
        return next(new Error('Authentication error: Internal error'));
    }
});

// Socket.io Connections
let users = [];
io.on('connection', socket => {
    console.log('User connected', socket.id);
    
    // Automatically register the user using their verified userId from the JWT payload
    const userId = socket.user.userId;
    users = users.filter(user => user.userId !== userId);
    const userObj = { userId, socketId: socket.id };
    users.push(userObj);
    io.emit('getUsers', users);

    socket.on('addUser', () => {
        // Fallback for compatibility: keep getUsers update
        io.emit('getUsers', users);
    });

    socket.on('sendMessage', async ({ receiverId, message, conversationId }) => {
        const senderId = socket.user.userId;
        const receiver = users.find(user => user.userId === receiverId);
        const user = await Users.findById(senderId);
        console.log('sender :>> ', socket.id, receiver);
        const payload = {
            senderId,
            message,
            conversationId,
            receiverId,
            user: { id: user._id, fullName: user.fullName, email: user.email }
        };
        if (receiver) {
            io.to(receiver.socketId).to(socket.id).emit('getMessage', payload);
        } else {
            io.to(socket.id).emit('getMessage', payload);
        }
    });

    socket.on('typing', ({ receiverId, isTyping }) => {
        const senderId = socket.user.userId;
        const receiver = users.find(user => user.userId === receiverId);
        if (receiver) {
            io.to(receiver.socketId).emit('typing', { senderId, isTyping });
        }
    });

    socket.on('disconnect', () => {
        users = users.filter(user => user.socketId !== socket.id);
        io.emit('getUsers', users);
    });
});

// Middleware
const authenticateToken = (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        
        if (!token) {
            return res.status(401).send('Access Token Required');
        }
        
        const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'THIS_IS_A_JWT_SECRET_KEY';
        jwt.verify(token, JWT_SECRET_KEY, (err, decoded) => {
            if (err) {
                return res.status(403).send('Invalid or Expired Token');
            }
            req.user = decoded;
            next();
        });
    } catch (error) {
        console.error('Auth Middleware Error:', error);
        return res.status(500).send('Internal Server Error');
    }
};

// Routes
app.get('/', (req, res) => {
    res.send('Welcome');
})

app.post('/api/register', async (req, res) => {
    try {
        const { fullName, email, password } = req.body;

        if (!fullName || !email || !password) {
            return res.status(400).send('Please fill all required fields');
        }

        const isAlreadyExist = await Users.findOne({ email });
        if (isAlreadyExist) {
            return res.status(400).send('User already exists');
        }

        const hashedPassword = await bcryptjs.hash(password, 10);
        const newUser = new Users({ fullName, email, password: hashedPassword });
        await newUser.save();
        return res.status(200).json({ message: 'User registered successfully' });
    } catch (error) {
        console.log(error, 'Error');
        return res.status(500).send('Internal Server Error');
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).send('Please fill all required fields');
        }

        const user = await Users.findOne({ email });
        if (!user) {
            return res.status(400).send('User email or password is incorrect');
        }

        const validateUser = await bcryptjs.compare(password, user.password);
        if (!validateUser) {
            return res.status(400).send('User email or password is incorrect');
        }

        const payload = {
            userId: user._id,
            email: user.email
        };
        const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'THIS_IS_A_JWT_SECRET_KEY';

        const token = jwt.sign(payload, JWT_SECRET_KEY, { expiresIn: 84600 });
        user.token = token;
        await user.save();

        return res.status(200).json({
            user: { id: user._id, email: user.email, fullName: user.fullName },
            token: token
        });
    } catch (error) {
        console.log(error, 'Error');
        return res.status(500).send('Internal Server Error');
    }
});

app.post('/api/conversation', authenticateToken, async (req, res) => {
    try {
        const { senderId, receiverId } = req.body;
        const newCoversation = new Conversations({ members: [senderId, receiverId] });
        await newCoversation.save();
        res.status(200).send('Conversation created successfully');
    } catch (error) {
        console.log(error, 'Error');
        res.status(500).send('Internal Server Error');
    }
})

app.get('/api/conversations/:userId', authenticateToken, async (req, res) => {
    try {
        const userId = req.params.userId;
        if (req.user.userId !== userId) {
            return res.status(403).send('Forbidden: Access denied');
        }
        const conversations = await Conversations.find({ members: { $in: [userId] } }).sort({ updatedAt: -1 });
        const conversationUserData = await Promise.all(conversations.map(async (conversation) => {
            const receiverId = conversation.members.find((member) => member !== userId);
            if (!receiverId) return null;
            const user = await Users.findById(receiverId);
            if (!user) return null;
            return { user: { receiverId: user._id, email: user.email, fullName: user.fullName }, conversationId: conversation._id }
        }));
        res.status(200).json(conversationUserData.filter(c => c !== null));
    } catch (error) {
        console.log(error, 'Error');
        res.status(500).send('Internal Server Error');
    }
})

app.post('/api/message', authenticateToken, async (req, res) => {
    try {
        const { conversationId, senderId, message, receiverId = '' } = req.body;
        if (!senderId || !message) return res.status(400).send('Please fill all required fields');
        
        if (req.user.userId !== senderId) {
            return res.status(403).send('Forbidden: Access denied');
        }

        let activeConversationId = conversationId;
        
        if (activeConversationId === 'new' && receiverId) {
            const existingConversation = await Conversations.findOne({ members: { $all: [senderId, receiverId] } });
            if (existingConversation) {
                activeConversationId = existingConversation._id;
            } else {
                const newConversation = new Conversations({ members: [senderId, receiverId] });
                await newConversation.save();
                activeConversationId = newConversation._id;
            }
        } else if (!activeConversationId && !receiverId) {
            return res.status(400).send('Please fill all required fields');
        }

        const newMessage = new Messages({ conversationId: activeConversationId, senderId, message });
        await newMessage.save();

        // Update the conversation's updatedAt timestamp to bring it to the top
        await Conversations.findByIdAndUpdate(activeConversationId, { updatedAt: new Date() });

        return res.status(200).json({ message: 'Message sent successfully', conversationId: activeConversationId });
    } catch (error) {
        console.log(error, 'Error');
        return res.status(500).send('Internal Server Error');
    }
});

app.get('/api/message/:conversationId', authenticateToken, async (req, res) => {
    try {
        const checkMessages = async (id) => {
            const messages = await Messages.find({ conversationId: id });
            const messageUserData = await Promise.all(messages.map(async (message) => {
                const user = await Users.findById(message.senderId);
                return { 
                    user: { id: user?._id, email: user?.email, fullName: user?.fullName }, 
                    message: message.message,
                    createdAt: message.createdAt
                }
            }));
            return res.status(200).json({ messages: messageUserData, conversationId: id });
        }
        
        const conversationId = req.params.conversationId;
        if (conversationId === 'new') {
            const senderId = req.query.senderId;
            const receiverId = req.query.receiverId;

            if (req.user.userId !== senderId) {
                return res.status(403).send('Forbidden: Access denied');
            }

            const checkConversation = await Conversations.find({ members: { $all: [senderId, receiverId] } });
            if (checkConversation.length > 0) {
                await checkMessages(checkConversation[0]._id);
            } else {
                return res.status(200).json({ messages: [], conversationId: 'new' });
            }
        } else {
            // Verify if user is part of the conversation
            const conversation = await Conversations.findById(conversationId);
            if (!conversation || !conversation.members.includes(req.user.userId)) {
                return res.status(403).send('Forbidden: Access denied');
            }
            await checkMessages(conversationId);
        }
    } catch (error) {
        console.log('Error', error);
        return res.status(500).send('Internal Server Error');
    }
});

app.get('/api/users/:userId', authenticateToken, async (req, res) => {
    try {
        const userId = req.params.userId;
        if (req.user.userId !== userId) {
            return res.status(403).send('Forbidden: Access denied');
        }
        const users = await Users.find({ _id: { $ne: userId } });
        const usersData = await Promise.all(users.map(async (user) => {
            return { user: { email: user.email, fullName: user.fullName, receiverId: user._id } }
        }))
        res.status(200).json(usersData);
    } catch (error) {
        console.log('Error', error);
        return res.status(500).send('Internal Server Error');
    }
})

app.listen(port, () => {
    console.log('listening on port ' + port);
})