import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../services/db';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/token';
import { AuthenticatedRequest } from '../middleware/auth';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Utility to parse cookies manually from Request headers
const parseCookies = (req: Request) => {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return {};
  
  return cookieHeader.split(';').reduce((acc, cookie) => {
    const parts = cookie.split('=');
    const name = parts[0].trim();
    const val = parts.slice(1).join('=');
    acc[name] = decodeURIComponent(val);
    return acc;
  }, {} as Record<string, string>);
};

export const register = async (req: Request, res: Response): Promise<any> => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already in use' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
    });

    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    // Set refresh token as HTTP-only cookie
    res.setHeader('Set-Cookie', `refreshToken=${encodeURIComponent(refreshToken)}; HttpOnly; Path=/; Max-Age=604800; SameSite=Strict;${process.env.NODE_ENV === 'production' ? ' Secure;' : ''}`);

    return res.status(201).json({
      message: 'User registered successfully',
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const login = async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    // Set refresh token as HTTP-only cookie
    res.setHeader('Set-Cookie', `refreshToken=${encodeURIComponent(refreshToken)}; HttpOnly; Path=/; Max-Age=604800; SameSite=Strict;${process.env.NODE_ENV === 'production' ? ' Secure;' : ''}`);

    return res.status(200).json({
      message: 'Logged in successfully',
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const refresh = async (req: Request, res: Response): Promise<any> => {
  try {
    const cookies = parseCookies(req);
    const refreshToken = cookies.refreshToken || req.body?.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token missing' });
    }

    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) {
      return res.status(401).json({ message: 'Invalid or expired refresh token' });
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    const accessToken = generateAccessToken(user.id);
    const newRefreshToken = generateRefreshToken(user.id);

    // Set new refresh token as HTTP-only cookie
    res.setHeader('Set-Cookie', `refreshToken=${encodeURIComponent(newRefreshToken)}; HttpOnly; Path=/; Max-Age=604800; SameSite=Strict;${process.env.NODE_ENV === 'production' ? ' Secure;' : ''}`);

    return res.status(200).json({
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error: any) {
    console.error('Token refresh error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const logout = async (req: Request, res: Response): Promise<any> => {
  res.setHeader('Set-Cookie', 'refreshToken=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict;');
  return res.status(200).json({ message: 'Logged out successfully' });
};

export const getProfile = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json(user);
  } catch (error: any) {
    console.error('Get profile error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const getMeetingHistory = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const userId = req.userId;

    const rooms = await prisma.room.findMany({
      where: {
        OR: [
          { hostId: userId },
          { participants: { some: { userId } } }
        ]
      },
      include: {
        host: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc',
      }
    });

    return res.status(200).json(rooms);
  } catch (error: any) {
    console.error('Get meeting history error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
