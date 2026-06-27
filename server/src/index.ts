import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';

import { config } from './config';
import authRoutes from './routes/auth';
import roomRoutes from './routes/room';
import fileRoutes from './routes/file';
import { setupSocket } from './socket';

const app = express();
const server = http.createServer(app);

// Socket.io Server Setup with CORS
const io = new Server(server, {
  cors: {
    origin: config.clientUrl,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allows previewing uploaded images on front-end
}));
app.use(cors({
  origin: config.clientUrl,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Rate limiter for Auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 auth requests per window
  message: { message: 'Too many authentication attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/files', fileRoutes);

// Base route
app.get('/', (req, res) => {
  res.json({ message: 'ConnectSphere Server is running.' });
});

// Setup sockets
setupSocket(io);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction): any => {
  console.error('Unhandled Server Error:', err);
  return res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
  });
});

// Start Server
const PORT = config.port;
server.listen(PORT, () => {
  console.log(`[ConnectSphere] Server running in ${config.nodeEnv} mode on port ${PORT}`);
});
