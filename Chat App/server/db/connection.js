const mongoose = require('mongoose');

const dbUser = process.env.DB_USERNAME;
const dbPass = process.env.DB_PASSWORD;

const url = process.env.MONGODB_URI || (
    (dbUser && dbPass)
        ? `mongodb+srv://${dbUser}:${dbPass}@cluster0.zw6hky5.mongodb.net/?retryWrites=true&w=majority`
        : `mongodb://127.0.0.1:27017/chat-app`
);

mongoose.connect(url, {
    useNewUrlParser: true, 
    useUnifiedTopology: true
}).then(() => console.log('Connected to DB (' + (dbUser && dbPass ? 'Atlas' : 'Local') + ')')).catch((e)=> console.log('Error connecting to DB', e))