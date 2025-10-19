const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const PatreonService = require('./patreonService');
require('dotenv').config();

const {
  initDatabase,
  createUser,
  getUserByEmail,
  getUserByUsername,
  getUserById,
  getUserByPatreonId,
  getAllUsers,
  updateUser,
  deleteUser
} = require('./database');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

// Initialize Patreon service
const patreonService = new PatreonService();

// Middleware
app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true
}));
app.use(express.json());

// JWT verification middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Admin verification middleware
const requireAdmin = (req, res, next) => {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ message: 'Server is running' });
});

// Register new user
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password, whatsapp_number, patreon_id, mixcloud_id, is_free, is_admin } = req.body;

    // Validate required fields
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    // Check if user already exists
    const existingUserByEmail = await getUserByEmail(email);
    const existingUserByUsername = await getUserByUsername(username);

    if (existingUserByEmail) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    if (existingUserByUsername) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const userData = {
      username,
      email,
      password: hashedPassword,
      whatsapp_number: whatsapp_number || null,
      patreon_id: patreon_id || null,
      mixcloud_id: mixcloud_id || null,
      is_free: is_free !== undefined ? is_free : true,
      is_admin: is_admin !== undefined ? is_admin : false
    };

    const newUser = await createUser(userData);

    // Generate JWT token
    const token = jwt.sign(
      { id: newUser.id, username: newUser.username, email: newUser.email, is_admin: newUser.is_admin },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Return user data without password
    const { password: _, ...userWithoutPassword } = newUser;
    res.status(201).json({
      message: 'User created successfully',
      user: userWithoutPassword,
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login user
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user by email
    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email, is_admin: user.is_admin },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Return user data without password
    const { password: _, ...userWithoutPassword } = user;
    res.json({
      message: 'Login successful',
      user: userWithoutPassword,
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user profile
app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { password: _, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all users (admin only)
app.get('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await getAllUsers();
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user profile
app.put('/api/profile', authenticateToken, async (req, res) => {
  try {
    const { username, email, whatsapp_number, patreon_id, mixcloud_id, is_free, is_admin } = req.body;
    const userId = req.user.id;

    // Check if username or email is being changed and if they're already taken
    if (username) {
      const existingUser = await getUserByUsername(username);
      if (existingUser && existingUser.id !== userId) {
        return res.status(400).json({ error: 'Username already taken' });
      }
    }

    if (email) {
      const existingUser = await getUserByEmail(email);
      if (existingUser && existingUser.id !== userId) {
        return res.status(400).json({ error: 'Email already taken' });
      }
    }

    const updateData = {
      username: username || req.user.username,
      email: email || req.user.email,
      whatsapp_number,
      patreon_id,
      mixcloud_id,
      is_free,
      is_admin
    };

    const updatedUser = await updateUser(userId, updateData);
    res.json({ message: 'Profile updated successfully', user: updatedUser });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user by ID (admin functionality)
app.put('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, whatsapp_number, patreon_id, mixcloud_id, is_free, is_admin } = req.body;

    // Check if username or email is being changed and if they're already taken
    if (username) {
      const existingUser = await getUserByUsername(username);
      if (existingUser && existingUser.id !== parseInt(id)) {
        return res.status(400).json({ error: 'Username already taken' });
      }
    }

    if (email) {
      const existingUser = await getUserByEmail(email);
      if (existingUser && existingUser.id !== parseInt(id)) {
        return res.status(400).json({ error: 'Email already taken' });
      }
    }

    const updateData = {
      username,
      email,
      whatsapp_number,
      patreon_id,
      mixcloud_id,
      is_free,
      is_admin
    };

    const updatedUser = await updateUser(id, updateData);
    res.json({ message: 'User updated successfully', user: updatedUser });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete user (admin only)
app.delete('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await deleteUser(id);
    
    if (result.deleted) {
      res.json({ message: 'User deleted successfully' });
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Patreon API endpoints (admin only)

// Test Patreon connection
app.post('/api/patreon/test', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { accessToken } = req.body;
    
    if (!accessToken) {
      return res.status(400).json({ error: 'Access token is required' });
    }

    patreonService.setAccessToken(accessToken);
    const result = await patreonService.testConnection();
    
    if (result.success) {
      res.json({
        message: 'Patreon connection successful',
        campaign: result.campaign
      });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    console.error('Patreon test connection error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get active Patreon patrons
app.get('/api/patreon/patrons/active', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await patreonService.getActivePatrons();
    
    if (result.success) {
      res.json({
        message: 'Active patrons retrieved successfully',
        patrons: result.patrons,
        total: result.total,
        pagination: result.pagination
      });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    console.error('Get active patrons error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all Patreon patrons
app.get('/api/patreon/patrons', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await patreonService.getAllPatrons();
    
    if (result.success) {
      res.json({
        message: 'All patrons retrieved successfully',
        patrons: result.patrons,
        total: result.total,
        pagination: result.pagination
      });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    console.error('Get all patrons error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get campaign tiers
app.get('/api/patreon/tiers', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await patreonService.getCampaignTiers();
    
    if (result.success) {
      res.json({
        message: 'Campaign tiers retrieved successfully',
        tiers: result.tiers
      });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    console.error('Get campaign tiers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Sync Patreon patrons with local users (enhanced with subscription tracking)
app.post('/api/patreon/sync', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { accessToken } = req.body;
    
    if (!accessToken) {
      return res.status(400).json({ error: 'Access token is required' });
    }

    patreonService.setAccessToken(accessToken);
    
    // Get both active and all patrons to track subscription changes
    const [activeResult, allResult] = await Promise.all([
      patreonService.getActivePatrons(),
      patreonService.getAllPatrons()
    ]);
    
    if (!activeResult.success || !allResult.success) {
      return res.status(400).json({ error: 'Failed to fetch Patreon data' });
    }

    const activePatronIds = new Set(activeResult.patrons.map(p => p.user?.id).filter(Boolean));
    const allPatronIds = new Set(allResult.patrons.map(p => p.user?.id).filter(Boolean));
    
    const syncedUsers = [];
    const errors = [];
    const subscriptionAlerts = [];
    const currentTime = new Date().toISOString();

    // Process all patrons (active and inactive)
    for (const patron of allResult.patrons) {
      if (patron.user && patron.user.email) {
        try {
          // Check if user exists by email or Patreon ID
          let existingUser = await getUserByEmail(patron.user.email);
          if (!existingUser && patron.user.id) {
            existingUser = await getUserByPatreonId(patron.user.id);
          }
          
          const isActivePatron = activePatronIds.has(patron.user.id);
          const subscriptionStatus = isActivePatron ? 'active_patron' : patron.patron_status;
          
          if (existingUser) {
            // Check for subscription status changes that matter
            const wasPremium = !existingUser.is_free;
            const wasActive = existingUser.patreon_subscription_status === 'active_patron';
            const isNowInactive = !isActivePatron && wasActive;
            
            // Only alert if user was premium and is now unsubscribed
            if (wasPremium && isNowInactive && !existingUser.subscription_alert_sent) {
              subscriptionAlerts.push({
                user: existingUser,
                patron: patron,
                action: 'unsubscribed',
                message: `Premium user ${existingUser.username} (${existingUser.email}) has unsubscribed from Patreon`
              });
            }
            
            // Update existing user with Patreon info
            const updateData = {
              username: existingUser.username,
              email: existingUser.email,
              whatsapp_number: existingUser.whatsapp_number,
              patreon_id: patron.user.id,
              mixcloud_id: existingUser.mixcloud_id,
              is_free: !isActivePatron ? true : false, // Set to free if not active patron
              is_admin: existingUser.is_admin,
              patreon_subscription_status: subscriptionStatus,
              last_patreon_sync: currentTime,
              subscription_alert_sent: isNowInactive ? true : existingUser.subscription_alert_sent
            };
            
            const updatedUser = await updateUser(existingUser.id, updateData);
            syncedUsers.push({ 
              action: 'updated', 
              user: updatedUser, 
              patron: patron,
              subscriptionChange: wasActive !== isActivePatron ? (isActivePatron ? 'subscribed' : 'unsubscribed') : 'none'
            });
          } else {
            // Create new user from Patreon data
            const userData = {
              username: patron.user.full_name || patron.user.email.split('@')[0],
              email: patron.user.email,
              password: null, // Will need to set password later
              whatsapp_number: null,
              patreon_id: patron.user.id,
              mixcloud_id: null,
              is_free: !isActivePatron, // Set to free if not active patron
              is_admin: false,
              patreon_subscription_status: subscriptionStatus,
              last_patreon_sync: currentTime,
              subscription_alert_sent: false
            };
            
            // Generate a temporary password
            const tempPassword = Math.random().toString(36).slice(-8);
            const hashedPassword = await bcrypt.hash(tempPassword, 10);
            userData.password = hashedPassword;
            
            const newUser = await createUser(userData);
            syncedUsers.push({ 
              action: 'created', 
              user: newUser, 
              patron: patron,
              tempPassword: tempPassword,
              subscriptionStatus: subscriptionStatus
            });
          }
        } catch (error) {
          errors.push({
            patron: patron,
            error: error.message
          });
        }
      }
    }

    res.json({
      message: 'Patreon sync completed with subscription tracking',
      synced: syncedUsers.length,
      errors: errors.length,
      subscriptionAlerts: subscriptionAlerts.length,
      details: {
        syncedUsers: syncedUsers,
        errors: errors,
        subscriptionAlerts: subscriptionAlerts
      }
    });

  } catch (error) {
    console.error('Patreon sync error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get subscription alerts (admin only)
app.get('/api/patreon/alerts', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Get users who have subscription alerts
    const users = await getAllUsers();
    const alerts = users
      .filter(user => user.subscription_alert_sent && user.patreon_subscription_status !== 'active_patron' && !user.is_free)
      .map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        patreon_id: user.patreon_id,
        subscription_status: user.patreon_subscription_status,
        last_sync: user.last_patreon_sync,
        alert_sent: user.subscription_alert_sent
      }));

    res.json({
      message: 'Subscription alerts retrieved',
      alerts: alerts,
      total: alerts.length
    });
  } catch (error) {
    console.error('Get subscription alerts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Clear subscription alert (admin only)
app.post('/api/patreon/alerts/:userId/clear', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await getUserById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updateData = {
      username: user.username,
      email: user.email,
      whatsapp_number: user.whatsapp_number,
      patreon_id: user.patreon_id,
      mixcloud_id: user.mixcloud_id,
      is_free: user.is_free,
      is_admin: user.is_admin,
      patreon_subscription_status: user.patreon_subscription_status,
      last_patreon_sync: user.last_patreon_sync,
      subscription_alert_sent: false
    };

    const updatedUser = await updateUser(userId, updateData);
    res.json({
      message: 'Subscription alert cleared',
      user: updatedUser
    });
  } catch (error) {
    console.error('Clear subscription alert error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Initialize database and start server
const startServer = async () => {
  try {
    await initDatabase();
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();


