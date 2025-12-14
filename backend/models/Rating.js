const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema({
    task_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task',
        required: true
    },
    rater_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    rated_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    rating_value: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    rating_type: {
        type: String,
        enum: ['GIVING', 'ACCEPTING'],
        required: true
    },
    comment: {
        type: String,
        default: null
    },
    created_at: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Ratig', ratingSchema);

