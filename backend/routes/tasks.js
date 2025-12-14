const express = require('express');
const { Task, User, TaskApplication, Rating, TaskComment } = require('../db');
const { authenticateToken } = require('../middleware');
const router = express.Router();

// Get user's own tasks (given by them) - MUST BE BEFORE /:id
router.get('/my/given', authenticateToken, async (req, res) => {
    try {
        const tasks = await Task.find({ giver_id: req.user.id })
            .populate('acceptor_id', 'username')
            .sort({ created_at: -1 });
        
        const formattedTasks = tasks.map(task => ({
            ...task.toObject(),
            task_id: task._id,
            acceptor_username: task.acceptor_id ? task.acceptor_id.username : null
        }));
        
        res.json(formattedTasks);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Get user's accepted tasks - MUST BE BEFORE /:id
router.get('/my/accepted', authenticateToken, async (req, res) => {
    try {
        const tasks = await Task.find({ acceptor_id: req.user.id })
            .populate('giver_id', 'username phone_number')
            .sort({ created_at: -1 });
        
        const formattedTasks = tasks.map(task => ({
            ...task.toObject(),
            task_id: task._id,
            giver_username: task.giver_id.username,
            giver_phone: task.giver_id.phone_number
        }));
        
        res.json(formattedTasks);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Get user's withdrawn/removed tasks (for rating purposes) - MUST BE BEFORE /:id
router.get('/my/withdrawn-removed', authenticateToken, async (req, res) => {
    try {
        const applications = await TaskApplication.find({
            applicant_id: req.user.id,
            status: { $in: ['WITHDRAWN', 'REMOVED'] }
        })
            .populate({
                path: 'task_id',
                populate: { path: 'giver_id', select: 'username phone_number' }
            })
            .sort({ applied_at: -1 });
        
        const formattedTasks = applications.map(app => ({
            ...app.task_id.toObject(),
            task_id: app.task_id._id,
            application_status: app.status,
            giver_username: app.task_id.giver_id.username,
            giver_phone: app.task_id.giver_id.phone_number
        }));
        
        res.json(formattedTasks);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Get user's applications - MUST BE BEFORE /:id
router.get('/my/applications', authenticateToken, async (req, res) => {
    try {
        const applications = await TaskApplication.find({ applicant_id: req.user.id })
            .populate({
                path: 'task_id',
                populate: { path: 'giver_id', select: 'username' }
            })
            .sort({ applied_at: -1 });
        
        const formattedApplications = applications.map(app => ({
            application_id: app._id,
            task_id: app.task_id._id,
            applicant_id: app.applicant_id,
            status: app.status,
            applied_at: app.applied_at,
            title: app.task_id.title,
            description: app.task_id.description,
            reward: app.task_id.reward,
            deadline: app.task_id.deadline,
            task_status: app.task_id.status,
            giver_username: app.task_id.giver_id.username
        }));
        
        res.json(formattedApplications);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Get all tasks with optional status filter
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { status } = req.query;
        let query = {};
        
        if (status) {
            query.status = status;
        }
        
        const tasks = await Task.find(query)
            .populate('giver_id', 'username giving_rating trophies')
            .sort({ created_at: -1 });
        
        const formattedTasks = tasks.map(task => ({
            ...task.toObject(),
            task_id: task._id,
            giver_username: task.giver_id.username,
            giving_rating: task.giver_id.giving_rating,
            giver_trophies: task.giver_id.trophies || 0
        }));
        
        res.json(formattedTasks);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Get a single task by ID with applications
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const task = await Task.findById(req.params.id)
            .populate('giver_id', 'username giving_rating phone_number trophies');
        
        if (!task) {
            return res.status(404).json({ msg: 'Task not found' });
        }

        const taskData = task.toObject();

        // Get applications for this task
        const applications = await TaskApplication.find({ task_id: req.params.id })
            .populate('applicant_id', 'username accepting_rating phone_number trophies')
            .sort({ applied_at: -1 });

        const formattedApplications = applications.map(app => ({
            application_id: app._id,
            task_id: app.task_id,
            applicant_id: app.applicant_id._id,
            status: app.status,
            applied_at: app.applied_at,
            username: app.applicant_id.username,
            accepting_rating: app.applicant_id.accepting_rating,
            phone_number: app.applicant_id.phone_number,
            trophies: app.applicant_id.trophies || 0
        }));

        res.json({
            task: {
                ...taskData,
                task_id: taskData._id
            },
            applications: formattedApplications
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Create a new task
router.post('/', authenticateToken, async (req, res) => {
    const { title, description, reward, deadline } = req.body;
    const giver_id = req.user.id;

    try {
        const newTask = new Task({
            giver_id,
            title,
            description,
            reward,
            deadline
        });
        const savedTask = await newTask.save();
        const taskObj = savedTask.toObject();
        res.status(201).json({
            ...taskObj,
            task_id: taskObj._id
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Apply for a task
router.post('/:id/apply', authenticateToken, async (req, res) => {
    try {
        const taskId = req.params.id;
        const applicantId = req.user.id;

        // Check if task exists and is open
        const task = await Task.findOne({ _id: taskId, status: 'OPEN' });

        if (!task) {
            return res.status(404).json({ msg: 'Task not found or not open' });
        }

        // Check if user is the task giver
        if (task.giver_id.toString() === applicantId) {
            return res.status(400).json({ msg: 'Cannot apply to your own task' });
        }

        // Check if already applied
        const existingApp = await TaskApplication.findOne({
            task_id: taskId,
            applicant_id: applicantId
        });

        if (existingApp) {
            return res.status(400).json({ msg: 'Already applied to this task' });
        }

        // Create application
        const newApplication = new TaskApplication({
            task_id: taskId,
            applicant_id: applicantId
        });
        await newApplication.save();

        res.status(201).json({ msg: 'Application submitted successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Accept an application (by task giver)
router.post('/:id/accept/:applicantId', authenticateToken, async (req, res) => {
    try {
        const taskId = req.params.id;
        const applicantId = req.params.applicantId;
        const giverId = req.user.id;

        // Verify the user is the task giver
        const task = await Task.findOne({ _id: taskId, giver_id: giverId });

        if (!task) {
            return res.status(403).json({ msg: 'Not authorized' });
        }

        if (task.status !== 'OPEN') {
            return res.status(400).json({ msg: 'Task is not open' });
        }

        // Update task status and set acceptor
        await Task.findByIdAndUpdate(taskId, {
            status: 'IN_PROGRESS',
            acceptor_id: applicantId
        });

        // Update application status
        await TaskApplication.findOneAndUpdate(
            { task_id: taskId, applicant_id: applicantId },
            { status: 'ACCEPTED' }
        );

        // Reject all other applications
        await TaskApplication.updateMany(
            { task_id: taskId, applicant_id: { $ne: applicantId } },
            { status: 'REJECTED' }
        );

        res.json({ msg: 'Application accepted successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Reject an application (by task giver)
router.post('/:id/reject/:applicantId', authenticateToken, async (req, res) => {
    try {
        const taskId = req.params.id;
        const applicantId = req.params.applicantId;
        const giverId = req.user.id;

        // Verify the user is the task giver
        const task = await Task.findOne({ _id: taskId, giver_id: giverId });

        if (!task) {
            return res.status(403).json({ msg: 'Not authorized' });
        }

        // Update application status
        await TaskApplication.findOneAndUpdate(
            { task_id: taskId, applicant_id: applicantId },
            { status: 'REJECTED' }
        );

        res.json({ msg: 'Application rejected' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Complete a task (by task giver)
router.post('/:id/complete', authenticateToken, async (req, res) => {
    try {
        const taskId = req.params.id;
        const giverId = req.user.id;

        // Verify the user is the task giver
        const task = await Task.findOne({ _id: taskId, giver_id: giverId });

        if (!task) {
            return res.status(403).json({ msg: 'Not authorized' });
        }

        if (task.status !== 'IN_PROGRESS') {
            return res.status(400).json({ msg: 'Task must be in progress to complete' });
        }

        const acceptorId = task.acceptor_id;

        // Update task status
        await Task.findByIdAndUpdate(taskId, { status: 'COMPLETED' });

        // Award trophy (tasks completed successfully)
        if (acceptorId) {
            console.log(`Awarding trophy: acceptor ${acceptorId}`);
            await User.findByIdAndUpdate(acceptorId, {
                $inc: { trophies: 1 }
            });
            console.log('Trophy awarded successfully');
        } else {
            console.log('No acceptor found, skipping trophy award');
        }

        res.json({ msg: 'Task marked as completed. Trophy awarded!' });
    } catch (err) {
        console.error('Error completing task:', err.message);
        res.status(500).send('Server Error');
    }
});

// Cancel a task (by task giver)
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const taskId = req.params.id;
        const giverId = req.user.id;

        // Verify the user is the task giver
        const task = await Task.findOne({ _id: taskId, giver_id: giverId });

        if (!task) {
            return res.status(403).json({ msg: 'Not authorized' });
        }

        // Update task status to CANCELLED
        await Task.findByIdAndUpdate(taskId, { status: 'CANCELLED' });

        res.json({ msg: 'Task cancelled successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Rate a user after task completion
router.post('/:id/rate', authenticateToken, async (req, res) => {
    try {
        const taskId = req.params.id;
        const raterId = req.user.id;
        const { rating_value, comment, rated_user_id } = req.body;

        if (!rating_value || rating_value < 1 || rating_value > 5) {
            return res.status(400).json({ msg: 'Rating must be between 1 and 5' });
        }

        // Get task details
        const task = await Task.findById(taskId);

        if (!task) {
            return res.status(404).json({ msg: 'Task not found' });
        }

        // Check if user was involved in this task through applications (for WITHDRAWN/REMOVED cases)
        const application = await TaskApplication.findOne({
            task_id: taskId,
            applicant_id: raterId,
            status: { $in: ['WITHDRAWN', 'REMOVED'] }
        });

        // Verify the user is involved in the task
        const isGiver = task.giver_id.toString() === raterId;
        const isAcceptor = task.acceptor_id && task.acceptor_id.toString() === raterId;
        const wasWithdrawn = application && application.status === 'WITHDRAWN';
        const wasRemoved = application && application.status === 'REMOVED';

        if (!isGiver && !isAcceptor && !wasWithdrawn && !wasRemoved) {
            return res.status(403).json({ msg: 'Not authorized to rate this task' });
        }

        // Allow rating only in specific cases:
        // 1. COMPLETED tasks: both can rate each other
        // 2. CANCELLED tasks: acceptor can rate giver
        // 3. WITHDRAWN: giver can rate the acceptor who withdrew
        // 4. REMOVED: removed acceptor can rate the giver
        if (task.status === 'COMPLETED') {
            // Both parties can rate
        } else if (task.status === 'CANCELLED') {
            // Only acceptor can rate giver
            if (!isAcceptor) {
                return res.status(403).json({ msg: 'Only acceptor can rate on cancelled tasks' });
            }
        } else if (wasWithdrawn) {
            // Only giver can rate the acceptor who withdrew
            if (!isGiver) {
                return res.status(403).json({ msg: 'Only giver can rate after withdrawal' });
            }
        } else if (wasRemoved) {
            // Only removed acceptor can rate the giver
            if (!wasRemoved || rated_user_id !== task.giver_id.toString()) {
                return res.status(403).json({ msg: 'Only removed acceptor can rate the giver' });
            }
        } else {
            return res.status(400).json({ msg: 'Task must be completed, cancelled, or have withdrawal/removal' });
        }

        // Determine rating type based on who is rating whom
        let rating_type;
        
        // For withdrawn/removed cases, check the application
        if (wasWithdrawn || wasRemoved) {
            const withdrawnUser = application.applicant_id.toString();
            
            if (wasWithdrawn) {
                // Giver rating the withdrawn acceptor
                if (raterId === task.giver_id.toString() && rated_user_id === withdrawnUser) {
                    rating_type = 'ACCEPTING';
                } else {
                    return res.status(403).json({ msg: 'Only giver can rate withdrawn acceptor' });
                }
            } else if (wasRemoved) {
                // Removed acceptor rating the giver
                if (raterId === withdrawnUser && rated_user_id === task.giver_id.toString()) {
                    rating_type = 'GIVING';
                } else {
                    return res.status(403).json({ msg: 'Only removed acceptor can rate the giver' });
                }
            }
        } else {
            // Normal cases: completed or cancelled
            if (raterId === task.giver_id.toString() && rated_user_id === task.acceptor_id.toString()) {
                rating_type = 'ACCEPTING';
                
                // If task is cancelled, giver cannot rate acceptor
                if (task.status === 'CANCELLED') {
                    return res.status(403).json({ msg: 'Cannot rate acceptor for a cancelled task' });
                }
            } else if (raterId === task.acceptor_id.toString() && rated_user_id === task.giver_id.toString()) {
                rating_type = 'GIVING';
            } else {
                return res.status(400).json({ msg: 'Invalid rating configuration' });
            }
        }

        // Check if already rated
        const existingRating = await Rating.findOne({
            task_id: taskId,
            rater_id: raterId
        });

        if (existingRating) {
            return res.status(400).json({ msg: 'You have already rated this task' });
        }

        // Insert rating
        const newRating = new Rating({
            task_id: taskId,
            rater_id: raterId,
            rated_id: rated_user_id,
            rating_value,
            rating_type,
            comment: comment || null
        });
        await newRating.save();

        // Update user's average rating (including initial 5.0)
        const ratings = await Rating.find({
            rated_id: rated_user_id,
            rating_type
        });

        const sum = ratings.reduce((acc, r) => acc + r.rating_value, 0);
        const count = ratings.length;
        const newAvg = (5.0 + sum) / (count + 1);
        
        const updateField = rating_type === 'GIVING' ? 'giving_rating' : 'accepting_rating';
        const countField = rating_type === 'GIVING' ? 'giving_rating_count' : 'accepting_rating_count';
        
        await User.findByIdAndUpdate(rated_user_id, {
            [updateField]: newAvg,
            [countField]: count
        });

        res.json({ msg: 'Rating submitted successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Check if user has rated a task
router.get('/:id/has-rated', authenticateToken, async (req, res) => {
    try {
        const taskId = req.params.id;
        const userId = req.user.id;

        const rating = await Rating.findOne({
            task_id: taskId,
            rater_id: userId
        });

        res.json({ has_rated: !!rating });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Duplicate a task
router.post('/:id/duplicate', authenticateToken, async (req, res) => {
    try {
        const taskId = req.params.id;
        const giverId = req.user.id;
        const { title, description, reward, deadline } = req.body;

        // Verify the user owns the original task
        const originalTask = await Task.findOne({ _id: taskId, giver_id: giverId });

        if (!originalTask) {
            return res.status(403).json({ msg: 'Not authorized or task not found' });
        }

        // Create new task with provided modifications
        const newTask = new Task({
            giver_id: giverId,
            title,
            description,
            reward,
            deadline
        });
        const savedTask = await newTask.save();
        const taskObj = savedTask.toObject();
        res.status(201).json({
            ...taskObj,
            task_id: taskObj._id
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Edit task (extend deadline and add comment about changes)
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const taskId = req.params.id;
        const giverId = req.user.id;
        const { deadline, comment } = req.body;

        // Verify the user owns the task
        const task = await Task.findOne({ _id: taskId, giver_id: giverId });

        if (!task) {
            return res.status(403).json({ msg: 'Not authorized or task not found' });
        }

        // Update deadline
        if (deadline) {
            await Task.findByIdAndUpdate(taskId, { deadline });
        }

        // Add comment about changes
        if (comment) {
            const newComment = new TaskComment({
                task_id: taskId,
                user_id: giverId,
                comment_text: comment
            });
            await newComment.save();
        }

        res.json({ msg: 'Task updated successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Get comments for a task (with nested structure)
router.get('/:id/comments', authenticateToken, async (req, res) => {
    try {
        const comments = await TaskComment.find({ task_id: req.params.id })
            .populate('user_id', 'username trophies')
            .populate({
                path: 'task_id',
                select: 'giver_id'
            })
            .sort({ created_at: 1 });
        
        // Build nested structure
        const commentMap = {};
        const rootComments = [];
        
        comments.forEach(comment => {
            const commentObj = comment.toObject();
            commentObj.comment_id = commentObj._id;
            commentObj.replies = [];
            commentObj.total_trophies = commentObj.user_id.trophies || 0;
            commentMap[commentObj.comment_id] = commentObj;
        });
        
        comments.forEach(comment => {
            const commentObj = commentMap[comment._id];
            if (comment.parent_comment_id) {
                if (commentMap[comment.parent_comment_id.toString()]) {
                    commentMap[comment.parent_comment_id.toString()].replies.push(commentObj);
                }
            } else {
                rootComments.push(commentObj);
            }
        });
        
        res.json(rootComments);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Add comment to a task (supports nested replies)
router.post('/:id/comments', authenticateToken, async (req, res) => {
    try {
        const taskId = req.params.id;
        const userId = req.user.id;
        const { comment_text, parent_comment_id } = req.body;

        if (!comment_text || comment_text.trim() === '') {
            return res.status(400).json({ msg: 'Comment cannot be empty' });
        }

        const newComment = new TaskComment({
            task_id: taskId,
            user_id: userId,
            comment_text,
            parent_comment_id: parent_comment_id || null
        });
        const savedComment = await newComment.save();

        const comment = await TaskComment.findById(savedComment._id)
            .populate('user_id', 'username trophies')
            .populate({
                path: 'task_id',
                select: 'giver_id'
            });

        const commentObj = comment.toObject();
        commentObj.comment_id = commentObj._id;
        commentObj.replies = [];
        commentObj.total_trophies = commentObj.user_id.trophies || 0;

        res.status(201).json(commentObj);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Auto-cancel expired tasks (to be called periodically)
router.post('/auto-cancel-expired', authenticateToken, async (req, res) => {
    try {
        const result = await Task.updateMany(
            {
                status: 'OPEN',
                deadline: { $lt: new Date() }
            },
            {
                status: 'CANCELLED'
            }
        );

        res.json({ 
            msg: 'Expired tasks cancelled', 
            count: result.modifiedCount 
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Acceptor says "Can't do it" - releases them from task and reopens it
router.post('/:id/cant-do', authenticateToken, async (req, res) => {
    try {
        const taskId = req.params.id;
        const userId = req.user.id;
        const { reason } = req.body;

        if (!reason || reason.trim() === '') {
            return res.status(400).json({ msg: 'Reason is required' });
        }

        // Verify the user is the acceptor
        const task = await Task.findOne({
            _id: taskId,
            acceptor_id: userId,
            status: 'IN_PROGRESS'
        });

        if (!task) {
            return res.status(403).json({ msg: 'Not authorized or task is not in progress' });
        }

        // Create a record of the withdrawal with reason
        const newApplication = new TaskApplication({
            task_id: taskId,
            applicant_id: userId,
            status: 'WITHDRAWN'
        });
        await newApplication.save();

        // Add reason as a comment
        const newComment = new TaskComment({
            task_id: taskId,
            user_id: userId,
            comment_text: `[WITHDRAWN] Reason: ${reason}`
        });
        await newComment.save();

        // Reset task to OPEN and remove acceptor
        await Task.findByIdAndUpdate(taskId, {
            status: 'OPEN',
            acceptor_id: null
        });

        res.json({ msg: 'Task released successfully. Giver can now rate you.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// Giver removes acceptor - reopens task
router.post('/:id/remove-acceptor', authenticateToken, async (req, res) => {
    try {
        const taskId = req.params.id;
        const giverId = req.user.id;
        const { reason } = req.body;

        if (!reason || reason.trim() === '') {
            return res.status(400).json({ msg: 'Reason is required' });
        }

        // Verify the user is the task giver
        const task = await Task.findOne({
            _id: taskId,
            giver_id: giverId,
            status: 'IN_PROGRESS'
        });

        if (!task) {
            return res.status(403).json({ msg: 'Not authorized or task is not in progress' });
        }

        const acceptorId = task.acceptor_id;

        if (!acceptorId) {
            return res.status(400).json({ msg: 'No acceptor assigned to this task' });
        }

        // Update application status to REMOVED
        await TaskApplication.findOneAndUpdate(
            { task_id: taskId, applicant_id: acceptorId },
            { status: 'REMOVED' }
        );

        // Add reason as a comment
        const newComment = new TaskComment({
            task_id: taskId,
            user_id: giverId,
            comment_text: `[REMOVED ACCEPTOR] Reason: ${reason}`
        });
        await newComment.save();

        // Reset task to OPEN and remove acceptor
        await Task.findByIdAndUpdate(taskId, {
            status: 'OPEN',
            acceptor_id: null
        });

        res.json({ msg: 'Acceptor removed successfully. They can now rate you.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

module.exports = router;
