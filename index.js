const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 7000;

// Set up EJS as the templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Helper functions
const readData = async (filePath) => {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading ${filePath}:`, error);
        return [];
    }
};

const writeData = async (filePath, data) => {
    try {
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error(`Error writing to ${filePath}:`, error);
        throw error;
    }
};

// Routes for rendering HTML pages
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'homePages.html')));
app.get('/messages', (req, res) => res.sendFile(path.join(__dirname, 'public', 'messages.html')));
app.get('/explore', (req, res) => res.sendFile(path.join(__dirname, 'public', 'explore.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'public', 'register.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));

// Profile route to render EJS template
app.get('/profile', async (req, res) => {
    try {
        const users = await readData(path.join(__dirname, 'users.json'));
        const user = users[0]; // Replace this with logic to fetch the logged-in user's data

        if (!user) {
            return res.status(404).render('error', { message: 'User not found' });
        }

        res.render('profile.ejs', { user });
    } catch (error) {
        console.log('Error fetching profile data:', error);
        res.status(500).render('error', { message: 'Failed to load profile data' });
    }
});

// API route to fetch profile data
app.get('/api/profile', async (req, res) => {
    try {
        const users = await readData(path.join(__dirname, 'users.json'));
        const user = users[0]; // Replace this with logic to fetch the logged-in user's data

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json(user);
    } catch (error) {
        console.log('Error fetching profile data:', error);
        res.status(500).json({ message: 'Failed to load profile data' });
    }
});

// API route to update profile data
app.post('/api/profile', async (req, res) => {
    try {
        const { name, email, bio } = req.body;

        // Validate required fields
        if (!name || !email) {
            return res.status(400).json({ message: 'Name and email are required' });
        }

        const users = await readData(path.join(__dirname, 'users.json'));
        const userIndex = users.findIndex(user => user.email === email);

        if (userIndex === -1) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Update user data
        users[userIndex].name = name;
        users[userIndex].email = email;
        if (bio !== undefined && bio.trim() !== '') {
            users[userIndex].bio = bio;
        }

        // Save updated data
        await writeData(path.join(__dirname, 'users.json'), users);

        res.status(200).json({ message: 'Profile updated successfully', user: users[userIndex] });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ message: 'Failed to update profile' });
    }
});

// API route to handle profile picture upload (without multer)
app.post('/api/upload-profile-picture', async (req, res) => {
    try {
        // For demonstration, return a placeholder URL
        const profilePictureUrl = "https://via.placeholder.com/150"; // Replace with your logic
        res.status(200).json({ profilePictureUrl });
    } catch (error) {
        console.error('Error uploading profile picture:', error);
        res.status(500).json({ message: 'Failed to upload profile picture' });
    }
});

// Messages routes
app.post('/messages', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message || message.trim() === '') return res.status(400).json({ message: 'Message cannot be empty' });

        const messages = await readData(path.join(__dirname, 'messages.json'));
        messages.push({ id: uuidv4(), message, timestamp: new Date().toISOString() });
        await writeData(path.join(__dirname, 'messages.json'), messages);

        res.status(200).json({ message: 'Message saved successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error processing the request' });
    }
});

app.get('/messages', async (req, res) => {
    try {
        const messages = await readData(path.join(__dirname, 'messages.json'));
        res.status(200).json(messages);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching messages' });
    }
});

app.put('/messages/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { message } = req.body;
        if (!message || message.trim() === '') return res.status(400).json({ message: 'Message cannot be empty' });

        const messages = await readData(path.join(__dirname, 'messages.json'));
        const messageIndex = messages.findIndex(msg => msg.id === id);
        if (messageIndex === -1) return res.status(404).json({ message: 'Message not found' });

        messages[messageIndex].message = message;
        await writeData(path.join(__dirname, 'messages.json'), messages);

        res.status(200).json({ message: 'Message updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error updating message' });
    }
});

app.delete('/messages/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const messages = await readData(path.join(__dirname, 'messages.json'));
        const filteredMessages = messages.filter(msg => msg.id !== id);

        if (messages.length === filteredMessages.length) return res.status(404).json({ message: 'Message not found' });

        await writeData(path.join(__dirname, 'messages.json'), filteredMessages);
        res.status(200).json({ message: 'Message deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error deleting message' });
    }
});

// Users routes
app.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) return res.status(400).json({ message: 'Name, email, and password are required' });

        const users = await readData(path.join(__dirname, 'users.json'));
        const userExists = users.some(user => user.email === email);
        if (userExists) return res.status(400).json({ message: 'User already exists' });

        const newUser = { id: uuidv4(), name, email, password };
        users.push(newUser);
        await writeData(path.join(__dirname, 'users.json'), users);

        res.status(200).json({ message: 'User registered successfully', user: newUser });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to register user' });
    }
});

app.get('/users', async (req, res) => {
    try {
        const users = await readData(path.join(__dirname, 'users.json'));
        res.status(200).json(users);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching users' });
    }
});

app.get('/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const users = await readData(path.join(__dirname, 'users.json'));
        const user = users.find(user => user.id === id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        res.status(200).json(user);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching user' });
    }
});

app.put('/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, bio, profilePicture } = req.body;
        if (!name || !email) return res.status(400).json({ message: 'Name and email are required' });

        const users = await readData(path.join(__dirname, 'users.json'));
        const userIndex = users.findIndex(user => user.id === id);
        if (userIndex === -1) return res.status(404).json({ message: 'User not found' });

        users[userIndex].name = name;
        users[userIndex].email = email;
        if (bio !== undefined && bio.trim() !== '') users[userIndex].bio = bio;
        if (profilePicture) users[userIndex].profilePicture = profilePicture;

        await writeData(path.join(__dirname, 'users.json'), users);
        res.status(200).json({ message: 'User updated successfully', user: users[userIndex] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error updating user' });
    }
});

app.delete('/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const users = await readData(path.join(__dirname, 'users.json'));
        const filteredUsers = users.filter(user => user.id !== id);

        if (users.length === filteredUsers.length) return res.status(404).json({ message: 'User not found' });

        await writeData(path.join(__dirname, 'users.json'), filteredUsers);
        res.status(200).json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error deleting user' });
    }
});

// Friend requests routes
app.post('/api/friend-requests', async (req, res) => {
    try {
        const { userId, friendId } = req.body;
        if (!userId || !friendId) return res.status(400).json({ message: 'User ID and Friend ID are required' });

        const friendRequests = await readData(path.join(__dirname, 'friendRequests.json'));
        const newRequest = { id: uuidv4(), userId, friendId, status: 'pending' };
        friendRequests.push(newRequest);

        await writeData(path.join(__dirname, 'friendRequests.json'), friendRequests);
        res.status(200).json({ message: 'Friend request sent successfully', request: newRequest });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error sending friend request' });
    }
});

app.get('/api/friend-requests', async (req, res) => {
    try {
        const friendRequests = await readData(path.join(__dirname, 'friendRequests.json'));
        res.status(200).json(friendRequests);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching friend requests' });
    }
});

app.put('/api/friend-requests/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!status || !['accepted', 'rejected'].includes(status)) return res.status(400).json({ message: 'Invalid status' });

        const friendRequests = await readData(path.join(__dirname, 'friendRequests.json'));
        const requestIndex = friendRequests.findIndex(request => request.id === id);
        if (requestIndex === -1) return res.status(404).json({ message: 'Friend request not found' });

        friendRequests[requestIndex].status = status;
        await writeData(path.join(__dirname, 'friendRequests.json'), friendRequests);

        res.status(200).json({ message: 'Friend request updated successfully', request: friendRequests[requestIndex] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error updating friend request' });
    }
});

app.delete('/api/friend-requests/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const friendRequests = await readData(path.join(__dirname, 'friendRequests.json'));
        const filteredRequests = friendRequests.filter(request => request.id !== id);

        if (friendRequests.length === filteredRequests.length) return res.status(404).json({ message: 'Friend request not found' });

        await writeData(path.join(__dirname, 'friendRequests.json'), filteredRequests);
        res.status(200).json({ message: 'Friend request deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error deleting friend request' });
    }
});

// Reddit posts route
app.get('/reddit-posts', async (req, res) => {
    try {
        const subreddit = req.query.subreddit || 'technology';
        const after = req.query.after || '';

        const response = await fetch(`https://www.reddit.com/r/${subreddit}/new.json?after=${after}`);
        if (!response.ok) throw new Error(`Failed to fetch data from Reddit: ${response.statusText}`);

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch Reddit posts' });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!' });
});

// Start the server
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));