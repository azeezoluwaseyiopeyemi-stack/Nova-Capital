const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

// Middleware
app.use(cors());
app.use(express.json());

// Temporary in-memory user storage (we will connect a database like MongoDB or PostgreSQL next)
const users = [];

// Root test route
app.get('/', (req, res) => {
  res.json({ message: 'Nova Capital Backend is running!' });
});

// Register Route
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // Check if user already exists
    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email.' });
    }

    // Hash the password securely
    const hashedPassword = await bcrypt.hash(password, 10);

    // Save user with initial $0.00 balances
    const newUser = {
      id: Date.now().toString(),
      name,
      email,
      password: hashedPassword,
      balances: {
        total: 0.00,
        available: 0.00,
        investment: 0.00,
        withdrawable: 0.00
      }
    };

    users.push(newUser);
    res.status(201).json({ message: 'Account created successfully!', userId: newUser.id });
  } catch (err) {
    res.status(500).json({ error: 'Server error during registration.' });
  }
});

// Login Route
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    // Generate JWT token
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });

    res.json({ message: 'Login successful', token, name: user.name, balances: user.balances });
  } catch (err) {
    res.status(500).json({ error: 'Server error during login.' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
