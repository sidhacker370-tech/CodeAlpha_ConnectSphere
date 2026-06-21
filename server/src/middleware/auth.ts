import { Request, Response, NextFunction } from 'express';
import { getAuth } from '../config/firebase';
import prisma from '../services/db';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userEmail?: string;
}

export const authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authorization token missing or invalid format' });
  }

  const token = authHeader.substring(7);
  let decodedToken: any = null;

  try {
    // If it's a dev fallback mock token (starts with JSON structure)
    if (process.env.NODE_ENV === 'development' && token.startsWith('{')) {
      try {
        decodedToken = JSON.parse(token);
      } catch (e) {
        // Not valid JSON, let it fall through to normal verify
      }
    }

    if (!decodedToken) {
      decodedToken = await getAuth().verifyIdToken(token);
    }
  } catch (error: any) {
    console.error('Firebase token verification failed:', error);
    return res.status(401).json({ message: 'Invalid or expired access token', error: error.message });
  }

  if (!decodedToken || !decodedToken.uid) {
    return res.status(401).json({ message: 'Invalid token claims' });
  }

  const { uid, email, name } = decodedToken;

  try {
    // Sync with database: find or create user
    let user = await prisma.user.findUnique({
      where: { id: uid },
    });

    if (!user) {
      // Find by email to see if they already exist from another source
      const existingUserByEmail = email ? await prisma.user.findUnique({ where: { email } }) : null;
      if (existingUserByEmail) {
        user = existingUserByEmail;
      } else {
        // Create new user record using Firebase details
        user = await prisma.user.create({
          data: {
            id: uid,
            email: email || `${uid}@connectsphere.local`,
            name: name || email?.split('@')[0] || 'ConnectSphere User',
            password: 'firebase-authenticated-user-placeholder-password',
          },
        });
        console.log(`Successfully auto-synced Firebase user ${uid} to database.`);
      }
    }

    req.userId = user.id;
    req.userEmail = user.email;
    next();
  } catch (dbError) {
    console.error('Database sync error in auth middleware:', dbError);
    return res.status(500).json({ message: 'Internal server error during user synchronization' });
  }
};

