const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Task, TaskApplication } = require('../db');
const router = express.Router();

// Register a new user
router.post('/register', async (req, res) => {
    const { username, password, phone_number, roll_number } = req.body;

    if(!username || !password || !phone_number || !roll_number) {
        return res.status(400).json({ msg: "Please enter all required fields" });
    }
    try {
        // Check for existing username
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({
            username,
            password: hashedPassword,
            phone_number,
            roll_number
        });
        const savedUser = await newUser.save();
        res.status(201).json({ user_id: savedUser._id, username: savedUser.username });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: "Server error" });
    }
});

// Login a user
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(400).json({ msg: "Invalid credentials" });
        }
        
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(400).json({ msg: "Invalid credentials" });
        }

        const payload = {
            id: user._id.toString(),
            username: user.username
        };

        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '5h' }, (err, token) => {
            if (err) throw err;
            res.json({ token });
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: "Server error" });
    }
});

// Get current user profile with stats
router.get('/profile', require('../middleware').authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password_hash');
        if (!user) {
            return res.status(404).json({ msg: "User not found" });
        }

        const tasksGiven = await Task.countDocuments({ giver_id: req.user.id });
        const tasksAccepted = await Task.countDocuments({ acceptor_id: req.user.id });
        const tasksCompleted = await Task.countDocuments({ acceptor_id: req.user.id, status: 'COMPLETED' });
        const applications = await TaskApplication.countDocuments({ applicant_id: req.user.id });

        const userData = user.toObject();
        res.json({
            ...userData,
            user_id: userData._id,
            trophies: userData.trophies || 0,
            stats: {
                tasks_given: tasksGiven,
                tasks_accepted: tasksAccepted,
                tasks_completed: tasksCompleted,
                applications: applications
            }
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server error");
    }
});

// Update user profile
router.put('/profile', require('../middleware').authenticateToken, async (req, res) => {
    try {
        const { phone_number, roll_number } = req.body;
        
        await User.findByIdAndUpdate(req.user.id, {
            phone_number,
            roll_number
        });

        res.json({ msg: "Profile updated successfully" });
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server error");
    }
});

// Get ratings received by user
router.get('/ratings', require('../middleware').authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Get all ratings received by this user
        const ratings = await Rating.find({ rated_id: userId })
            .populate('rater_id', 'username')
            .populate('task_id', 'title')
            .sort({ created_at: -1 });

        const formattedRatings = ratings.map(rating => ({
            rating_id: rating._id,
            task_id: rating.task_id._id,
            rater_id: rating.rater_id._id,
            rated_id: rating.rated_id,
            rating_value: rating.rating_value,
            rating_type: rating.rating_type,
            comment: rating.comment,
            created_at: rating.created_at,
            rater_username: rating.rater_id.username,
            task_title: rating.task_id.title
        }));

        res.json(formattedRatings);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server error");
    }
});

// Get leaderboard
router.get('/leaderboard', require('../middleware').authenticateToken, async (req, res) => {
    try {
        // Leaderboard based on tasks completed successfully (trophies) and overall rating
        const users = await User.find()
            .select('user_id username giving_rating accepting_rating trophies')
            .sort({ trophies: -1, giving_rating: -1, accepting_rating: -1 })
            .limit(50);

        const leaderboard = users.map(user => ({
            user_id: user._id,
            username: user.username,
            giving_rating: user.giving_rating,
            accepting_rating: user.accepting_rating,
            trophies: user.trophies || 0,
            overall_rating: (user.giving_rating + user.accepting_rating) / 2
        }));

        res.json(leaderboard);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server error");
    }
});

module.exports = router;
