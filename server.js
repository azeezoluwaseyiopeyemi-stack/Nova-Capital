const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';
const MONGO_URI = process.env.MONGO_URI || '';

app.use(cors());
app.use(express.json());

// Connect to MongoDB Atlas
mongoose.connect(MONGO_URI)
  .then(() => console.log('Connected to MongoDB Atlas successfully!'))
  .catch(err => console.error('MongoDB connection error:', err));

// 1. User Schema & Model
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isVerified: { type: Boolean, default: false },
  verificationCode: { type: String },
  isAdmin: { type: Boolean, default: false },
  balances: {
    total: { type: Number, default: 0.00 },
    available: { type: Number, default: 0.00 },
    investment: { type: Number, default: 0.00 },
    withdrawable: { type: Number, default: 0.00 }
  }
});
const User = mongoose.model('User', userSchema);

// 2. Transaction Schema & Model (NEW)
const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userEmail: { type: String, required: true },
  type: { type: String, enum: ['deposit', 'withdrawal'], required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  date: { type: Date, default: Date.now }
});
const Transaction = mongoose.model('Transaction', transactionSchema);

app.get('/', (req, res) => {
  res.json({ message: 'Nova Capital Full Backend is running!' });
});

// --- AUTH ROUTES ---

// Register Route
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const isAdmin = email === 'admin@novacapital.com';

    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      verificationCode,
      isAdmin
    });

    await newUser.save();

    res.status(201).json({ 
      message: 'Account created! Please check your verification code.', 
      userId: newUser._id,
      devCode: verificationCode 
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error during registration.' });
  }
});

// Verify Email Route
app.post('/api/verify-code', async (req, res) => {
  try {
    const { email, code } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(404).json({ error: 'User not found.' });

    if (user.verificationCode === code) {
      user.isVerified = true;
      user.verificationCode = undefined;
      await user.save();
      return res.json({ message: 'Email verified successfully! You can now log in.' });
    }

    res.status(400).json({ error: 'Invalid verification code.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error during verification.' });
  }
});

// Login Route
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Invalid email or password.' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid email or password.' });

    if (!user.isVerified) {
      return res.status(403).json({ error: 'Please verify your email address before logging in.' });
    }

    const token = jwt.sign({ userId: user._id, email: user.email, isAdmin: user.isAdmin }, JWT_SECRET, { expiresIn: '1h' });

    res.json({ 
      message: 'Login successful', 
      token, 
      name: user.name, 
      isAdmin: user.isAdmin,
      balances: user.balances 
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error during login.' });
  }
});

// --- TRANSACTION & ADMIN ROUTES (NEW) ---

// User submits deposit or withdrawal request
app.post('/api/transactions', async (req, res) => {
  try {
    const { userId, userEmail, type, amount } = req.body;
    const tx = new Transaction({ userId, userEmail, type, amount });
    await tx.save();
    res.status(201).json({ message: 'Request submitted successfully and is pending review.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error submitting transaction.' });
  }
});

// Admin fetches all pending transactions
app.get('/api/admin/transactions', async (req, res) => {
  try {
    const transactions = await Transaction.find({ status: 'pending' }).sort({ date: -1 });
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching transactions.' });
  }
});

// Admin approves transaction (credits user balance)
app.post('/api/admin/approve/:id', async (req, res) => {
  try {
    const tx = await Transaction.findById(req.params.id);
    if (!tx) return res.status(404).json({ error: 'Transaction not found.' });
    if (tx.status !== 'pending') return res.status(400).json({ error: 'Transaction already processed.' });

    tx.status = 'approved';
    await tx.save();

    if (tx.type === 'deposit') {
      const user = await User.findById(tx.userId);
      if (user) {
        user.balances.total += tx.amount;
        user.balances.available += tx.amount;
        await user.save();
      }
    }

    res.json({ message: 'Transaction approved and user balance updated!' });
  } catch (err) {
    res.status(500).json({ error: 'Server error processing approval.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
