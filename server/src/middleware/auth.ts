import { Request, Response, NextFunction } from 'express';
import { supabase } from '../services/supabase';
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
  let userId: string | undefined = undefined;
  let email: string | undefined = undefined;
  let name: string | undefined = undefined;

  try {
    // If it's a dev fallback mock token (starts with JSON structure)
    if (process.env.NODE_ENV === 'development' && token.startsWith('{')) {
      try {
        const decodedToken = JSON.parse(token);
        userId = decodedToken.uid || decodedToken.sub;
        email = decodedToken.email;
        name = decodedToken.name || decodedToken.user_metadata?.name || decodedToken.user_metadata?.full_name || email?.split('@')[0] || 'ConnectSphere User';
      } catch (e) {
        // Not valid JSON, let it fall through to normal verify
      }
    }

    if (!userId) {
      // Verify token with Supabase Auth service
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) {
        console.error('Supabase token verification failed:', error?.message || 'User not found');
        return res.status(401).json({ message: 'Invalid or expired access token', error: error?.message });
      }
      userId = user.id;
      email = user.email;
      name = user.user_metadata?.name || user.user_metadata?.full_name || email?.split('@')[0] || 'ConnectSphere User';
    }
  } catch (error: any) {
    console.error('Token verification exception:', error);
    return res.status(401).json({ message: 'Invalid or expired access token', error: error.message });
  }

  if (!userId) {
    return res.status(401).json({ message: 'Invalid token claims: missing user identifier' });
  }

  try {
    // Sync with database: find or create user
    let user = await prisma.user.findUnique({
      where: { id: userId },
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
            id: userId,
            email: email || `${userId}@connectsphere.local`,
            name: name || 'ConnectSphere User',
            password: 'supabase-authenticated-user-placeholder-password',
          },
        });
        console.log(`Successfully auto-synced Supabase user ${userId} to database.`);
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

