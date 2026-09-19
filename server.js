const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

app.use(cors());
app.use(express.json());

// Temporary in-memory user storage (we will hook up a database next)
const users = [];

app.get('/', (req, res) => {
  res.json({ message: 'Nova Capital Backend is running!' });
});

// 1. REGISTER ROUTE (Generates a 6-digit code)
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Generate a random 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Check if this is your admin email
    const isAdmin = email === 'admin@novacapital.com'; // Change this to your actual email later

    const newUser = {
      id: Date.now().toString(),
      name,
      email,
      password: hashedPassword,
      isVerified: false,
      verificationCode,
      isAdmin,
      balances: { total: 0.00, available: 0.00, investment: 0.00, withdrawable: 0.00 }
    };

    users.push(newUser);

    // TODO: Integrate Resend or Nodemailer here to send 'verificationCode' to user's email
    console.log(`[DEV EMAIL] Verification code for ${email}: ${verificationCode}`);

    res.status(201).json({ 
      message: 'Account created! Please check your email for the verification code.', 
      userId: newUser.id,
      // Returning code in development mode so you can test it easily right now
      devCode: verificationCode 
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error during registration.' });
  }
});

// 2. VERIFY EMAIL ROUTE
app.post('/api/verify-code', (req, res) => {
  const { email, code } = req.body;
  const user = users.find(u => u.email === email);

  if (!user) return res.status(404).json({ error: 'User not found.' });

  if (user.verificationCode === code) {
    user.isVerified = true;
    user.verificationCode = null; // Clear code after successful verification
    return res.json({ message: 'Email verified successfully! You can now log in.' });
  }

  res.status(400).json({ error: 'Invalid verification code.' });
});

// 3. LOGIN ROUTE (Checks if user is Admin or Client)
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = users.find(u => u.email === email);
    if (!user) return res.status(400).json({ error: 'Invalid email or password.' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid email or password.' });

    if (!user.isVerified) {
      return res.status(403).json({ error: 'Please verify your email address before logging in.' });
    }

    // Generate token including admin status
    const token = jwt.sign({ userId: user.id, email: user.email, isAdmin: user.isAdmin }, JWT_SECRET, { expiresIn: '1h' });

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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
