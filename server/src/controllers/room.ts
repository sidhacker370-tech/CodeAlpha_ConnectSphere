import { Response } from 'express';
import prisma from '../services/db';
import { AuthenticatedRequest } from '../middleware/auth';

const generateRoomCode = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  let part1 = '';
  let part2 = '';
  let part3 = '';
  for (let i = 0; i < 3; i++) part1 += chars[Math.floor(Math.random() * chars.length)];
  for (let i = 0; i < 4; i++) part2 += chars[Math.floor(Math.random() * chars.length)];
  for (let i = 0; i < 3; i++) part3 += chars[Math.floor(Math.random() * chars.length)];
  return `${part1}-${part2}-${part3}`;
};

export const createRoom = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const userId = req.userId!;
    
    let roomCode = generateRoomCode();
    let roomExists = await prisma.room.findUnique({ where: { roomCode } });
    
    while (roomExists) {
      roomCode = generateRoomCode();
      roomExists = await prisma.room.findUnique({ where: { roomCode } });
    }

    const room = await prisma.room.create({
      data: {
        roomCode,
        hostId: userId,
      },
    });

    // Add host as first participant
    await prisma.participant.create({
      data: {
        userId,
        roomId: room.id,
      },
    });

    return res.status(201).json({
      message: 'Room created successfully',
      room,
    });
  } catch (error) {
    console.error('Create room error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const joinRoom = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const userId = req.userId!;
    const { roomCode } = req.body;

    if (!roomCode) {
      return res.status(400).json({ message: 'Room code is required' });
    }

    const formattedCode = roomCode.trim().toLowerCase();

    const room = await prisma.room.findUnique({
      where: { roomCode: formattedCode },
    });

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    const existingParticipant = await prisma.participant.findFirst({
      where: {
        userId,
        roomId: room.id,
      },
    });

    if (!existingParticipant) {
      await prisma.participant.create({
        data: {
          userId,
          roomId: room.id,
        },
      });
    }

    return res.status(200).json({
      message: 'Joined room successfully',
      room,
    });
  } catch (error) {
    console.error('Join room error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const getRoom = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const { roomCode } = req.params;

    const room = await prisma.room.findUnique({
      where: { roomCode: roomCode.toLowerCase() },
      include: {
        host: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    return res.status(200).json(room);
  } catch (error) {
    console.error('Get room error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
