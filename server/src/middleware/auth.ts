import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
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
      const jwtSecret = process.env.SUPABASE_JWT_SECRET;
      if (!jwtSecret) {
        console.error('SUPABASE_JWT_SECRET environment variable is not defined.');
        return res.status(500).json({ message: 'Server configuration error' });
      }
      decodedToken = jwt.verify(token, jwtSecret);
    }
  } catch (error: any) {
    console.error('Supabase token verification failed:', error);
    return res.status(401).json({ message: 'Invalid or expired access token', error: error.message });
  }

  if (!decodedToken) {
    return res.status(401).json({ message: 'Invalid token claims' });
  }

  // Handle differences between Dev Mock Token (uid/email/name) and Supabase JWT (sub/email/user_metadata)
  const uid = decodedToken.sub || decodedToken.uid;
  const email = decodedToken.email;
  const name = decodedToken.user_metadata?.name || decodedToken.user_metadata?.full_name || decodedToken.name || email?.split('@')[0] || 'ConnectSphere User';

  if (!uid) {
    return res.status(401).json({ message: 'Invalid token claims: missing user identifier' });
  }

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
        // Create new user record using Supabase details
        user = await prisma.user.create({
          data: {
            id: uid,
            email: email || `${uid}@connectsphere.local`,
            name: name,
            password: 'supabase-authenticated-user-placeholder-password',
          },
        });
        console.log(`Successfully auto-synced Supabase user ${uid} to database.`);
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

