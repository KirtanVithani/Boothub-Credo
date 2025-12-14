const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { initDb } = require('./database');

const app = express();

// Initialize the database
initDb().catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
});

// Middleware
app.use(cors());
app.use(express.json()); // for parsing application/json

// Time synchronization endpoint - returns server time
app.get('/api/time', (req, res) => {
    res.json({ 
        serverTime: new Date().toISOString(),
        timestamp: Date.now()
    });
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/tasks', require('./routes/tasks'));

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
