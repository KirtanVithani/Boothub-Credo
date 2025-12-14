const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URL = process.env.MONGODB || 'mongodb://127.0.0.1:27017';

const initDb = async () => {
    try {
        await mongoose.connect(MONGODB_URL);
        console.log('Connected to MongoDB database.');
        console.log('MongoDB URI:', MONGODB_URL);
    } catch (err) {
        console.error('MongoDB connection error:', err.message);
        process.exit(1);
    }
};

module.exports = { initDb };
