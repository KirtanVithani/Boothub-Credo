const mongoose = require('mongoose');

const taskApplicationSchema = new mongoose.Schema({
    task_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task',
        required: true
    },
    applicant_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'REMOVED', 'WITHDRAWN'],
        default: 'PENDING'
    },
    applied_at: {
        type: Date,
        default: Date.now
    }
});

// Ensure unique combination of task_id and applicant_id
taskApplicationSchema.index({ task_id: 1, applicant_id: 1 }, { unique: true });

module.exports = mongoose.model('TaskApplication', taskApplicationSchema);

