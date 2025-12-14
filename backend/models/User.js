const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    phone_number: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    roll_number: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    giving_rating: {
        type: Number,
        default: 5.0
    },
    accepting_rating: {
        type: Number,
        default: 5.0
    },
    giving_rating_count: {
        type: Number,
        default: 0
    },
    accepting_rating_count: {
        type: Number,
        default: 0
    },
    trophies: {
        type: Number,
        default: 0
    },
    created_at: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('User', userSchema);

