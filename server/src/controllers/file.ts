import { Response } from 'express';
import path from 'path';
import fs from 'fs';
import prisma from '../services/db';
import { AuthenticatedRequest } from '../middleware/auth';

const UPLOAD_DIR = path.join(__dirname, '../../uploads');

export const uploadFile = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const userId = req.userId!;
    const { roomId } = req.body;

    if (!roomId) {
      return res.status(400).json({ message: 'Room ID is required' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded or file rejected by filter' });
    }

    const room = await prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      const filePath = path.join(UPLOAD_DIR, req.file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return res.status(404).json({ message: 'Room not found' });
    }

    const sharedFile = await prisma.sharedFile.create({
      data: {
        roomId,
        fileUrl: `/api/files/download/${req.file.filename}`,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        uploadedBy: userId,
      },
      include: {
        uploader: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return res.status(201).json({
      message: 'File uploaded successfully',
      file: sharedFile,
    });
  } catch (error) {
    console.error('Upload file error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const getRoomFiles = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const { roomId } = req.params;

    const files = await prisma.sharedFile.findMany({
      where: { roomId },
      include: {
        uploader: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return res.status(200).json(files);
  } catch (error) {
    console.error('Get room files error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const downloadFile = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const { filename } = req.params;
    
    const fileRecord = await prisma.sharedFile.findFirst({
      where: {
        fileUrl: {
          endsWith: filename
        }
      }
    });

    if (!fileRecord) {
      return res.status(404).json({ message: 'File not found in system records' });
    }

    const filePath = path.join(UPLOAD_DIR, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found on disk' });
    }

    return res.download(filePath, fileRecord.fileName);
  } catch (error) {
    console.error('Download file error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
