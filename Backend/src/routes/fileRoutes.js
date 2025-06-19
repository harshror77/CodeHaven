import express from 'express';
import {
    getRoomFiles,
    createFileOrFolder,
    updateFile,
    deleteFileOrFolder,
    getFileContent
} from '../controllers/fileController.js';

const router = express.Router();

// GET all files for a room
router.get('/:roomId', getRoomFiles);

// POST create file or folder
router.post('/', createFileOrFolder);

// ✅ PUT and DELETE using RegExp to support slashes in file paths
router.put(/^\/([^\/]+)\/(.+)$/, updateFile);
router.delete(/^\/([^\/]+)\/(.+)$/, deleteFileOrFolder);
router.get(/^\/([^\/]+)\/(.+)$/, getFileContent);

export default router;
