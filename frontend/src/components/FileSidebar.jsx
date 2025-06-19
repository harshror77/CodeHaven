import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
    FolderIcon,
    File,
    PlusIcon,
    TrashIcon,
    FolderOpen,
    FileText,
    Image,
    Code,
    Video,
    Music,
    RefreshCw,
} from 'lucide-react';

// Use the same API base URL as CodeEditor
const api = axios.create({
    baseURL: 'http://localhost:3000/api',
    headers: { 'Content-Type': 'application/json' },
});

export default function FileExplorer({ roomId, onFileSelect }) {
    const [items, setItems] = useState([]);
    const [newName, setNewName] = useState('');
    const [newType, setNewType] = useState('file');
    const [selectedPath, setSelectedPath] = useState('');
    const [expandedFolders, setExpandedFolders] = useState(new Set());
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchItems();
    }, [roomId]);

    async function fetchItems() {
        if (!roomId) return;

        setIsLoading(true);
        setError('');
        try {
            const res = await api.get(`/files/${roomId}`);
            if (res.data.success) {
                setItems(buildFileTree(res.data.files));
            } else {
                setError('Failed to load files');
            }
        } catch (err) {
            console.error('Error loading items:', err);
            setError(err.response?.data?.error || 'Failed to load files');
        } finally {
            setIsLoading(false);
        }
    }

    // Build hierarchical file tree from flat array
    const buildFileTree = (files) => {
        const tree = [];
        const pathMap = new Map();

        // Sort files by path for proper hierarchy
        const sortedFiles = [...files].sort((a, b) => {
            // Folders first, then files
            if (a.type !== b.type) {
                return a.type === 'folder' ? -1 : 1;
            }
            return a.path.localeCompare(b.path);
        });

        sortedFiles.forEach(file => {
            const pathParts = file.path.split('/').filter(part => part);
            const depth = pathParts.length - 1;

            const treeItem = {
                ...file,
                depth,
                children: file.type === 'folder' ? [] : undefined
            };

            pathMap.set(file.path, treeItem);

            // Root level items (no parent)
            if (depth === 0 || file.path.startsWith('/') && file.path.split('/').filter(p => p).length === 1) {
                tree.push(treeItem);
            } else {
                // Find parent folder
                const parentPath = '/' + pathParts.slice(0, -1).join('/');
                const parent = pathMap.get(parentPath);

                if (parent && parent.children) {
                    parent.children.push(treeItem);
                } else {
                    // If parent not found, add to root (fallback)
                    tree.push(treeItem);
                }
            }
        });

        return tree;
    };

    // Flatten tree for rendering with proper indentation
    const flattenTree = (items, expanded = expandedFolders) => {
        const result = [];

        const traverse = (nodes, depth = 0) => {
            nodes.forEach(node => {
                result.push({ ...node, depth });

                if (node.type === 'folder' && node.children && expanded.has(node.path)) {
                    traverse(node.children, depth + 1);
                }
            });
        };

        traverse(items);
        return result;
    };

    const getFileIcon = (item) => {
        if (item.type === 'folder') {
            const isExpanded = expandedFolders.has(item.path);
            return isExpanded ?
                <FolderOpen size={18} className="text-blue-400" /> :
                <FolderIcon size={18} className="text-blue-400" />;
        }

        const extension = item.name.split('.').pop()?.toLowerCase();
        const iconProps = { size: 18 };

        if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(extension)) {
            return <Image {...iconProps} className="text-green-400" />;
        }
        if (['js', 'jsx', 'ts', 'tsx', 'html', 'css', 'py', 'java', 'c', 'cpp', 'h'].includes(extension)) {
            return <Code {...iconProps} className="text-purple-400" />;
        }
        if (['mp4', 'avi', 'mov', 'mkv'].includes(extension)) {
            return <Video {...iconProps} className="text-red-400" />;
        }
        if (['mp3', 'wav', 'flac', 'ogg'].includes(extension)) {
            return <Music {...iconProps} className="text-yellow-400" />;
        }
        return <FileText {...iconProps} className="text-gray-300" />;
    };

    const handleSelect = async (item) => {
        setSelectedPath(item.path);

        if (item.type === 'folder') {
            // Toggle folder expansion
            setExpandedFolders(prev => {
                const newSet = new Set(prev);
                if (newSet.has(item.path)) {
                    newSet.delete(item.path);
                } else {
                    newSet.add(item.path);
                }
                return newSet;
            });
        } else {
            // Load file content and pass to CodeEditor
            try {
                const fileData = {
                    ...item,
                    // Ensure content is available
                    content: item.content || ''
                };
                onFileSelect(fileData);
            } catch (error) {
                console.error('Error selecting file:', error);
                setError('Failed to load file content');
            }
        }
    };

    const handleCreate = async () => {
        if (!newName.trim()) return;

        // Determine the full path based on current selection
        let fullPath;
        const findItemByPath = (nodes, targetPath) => {
            for (const node of nodes) {
                if (node.path === targetPath) return node;
                if (node.children) {
                    const found = findItemByPath(node.children, targetPath);
                    if (found) return found;
                }
            }
            return null;
        };

        if (selectedPath && items.length > 0) {
            const selectedItem = findItemByPath(items, selectedPath);
            if (selectedItem?.type === 'folder') {
                // Create inside selected folder
                const folderPath = selectedPath.endsWith('/') ? selectedPath : selectedPath + '/';
                fullPath = folderPath + newName;
            } else {
                // Create at root level
                fullPath = '/' + newName;
            }
        } else {
            // Create at root level
            fullPath = '/' + newName;
        }

        try {
            const response = await api.post('/files', {
                roomId,
                name: newName,
                path: fullPath,
                type: newType,
                content: newType === 'file' ? '' : undefined
            });

            if (response.data.success) {
                setNewName('');
                await fetchItems();

                // Auto-expand parent folder if creating inside it
                if (selectedPath && newType === 'file') {
                    setExpandedFolders(prev => new Set([...prev, selectedPath]));
                }
            } else {
                setError(response.data.error || 'Failed to create item');
            }
        } catch (err) {
            console.error('Error creating item:', err);
            setError(err.response?.data?.error || 'Failed to create item');
        }
    };

    const handleDelete = async (item, e) => {
        e.stopPropagation();

        if (!confirm(`Are you sure you want to delete "${item.name}"?`)) {
            return;
        }

        try {
            const response = await api.delete(`/files/${roomId}/${encodeURIComponent(item.path)}`);

            if (response.data.success) {
                if (selectedPath === item.path) {
                    setSelectedPath('');
                }
                await fetchItems();
            } else {
                setError(response.data.error || 'Failed to delete item');
            }
        } catch (err) {
            console.error('Error deleting item:', err);
            setError(err.response?.data?.error || 'Failed to delete item');
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleCreate();
        }
    };

    const handleRefresh = () => {
        fetchItems();
    };

    const flattenedItems = flattenTree(items);

    return (
        <div className="w-80 bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4 border-b border-slate-600/50">
                <div className="flex items-center justify-between">
                    <h2 className="text-white font-bold text-lg flex items-center gap-2">
                        <FolderIcon size={20} className="text-blue-400" />
                        File Explorer
                    </h2>
                    <button
                        onClick={handleRefresh}
                        disabled={isLoading}
                        className="text-slate-400 hover:text-white transition-colors p-1 rounded"
                        title="Refresh files"
                    >
                        <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-2">
                    <p className="text-red-400 text-sm">{error}</p>
                </div>
            )}

            {/* File List */}
            <div className="flex-1 overflow-hidden flex flex-col">
                <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent p-4">
                    {isLoading ? (
                        <div className="text-center py-8 text-slate-400">
                            <RefreshCw size={48} className="mx-auto mb-3 opacity-50 animate-spin" />
                            <p className="text-sm">Loading files...</p>
                        </div>
                    ) : flattenedItems.length === 0 ? (
                        <div className="text-center py-8 text-slate-400">
                            <FolderIcon size={48} className="mx-auto mb-3 opacity-50" />
                            <p className="text-sm">No files yet</p>
                            <p className="text-xs mt-1">Create your first file or folder below</p>
                        </div>
                    ) : (
                        <ul className="space-y-1">
                            {flattenedItems.map(item => (
                                <li key={item._id} style={{ paddingLeft: `${item.depth * 16}px` }}>
                                    <div
                                        className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all duration-200 
                                            ${selectedPath === item.path
                                                ? 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-400/30 shadow-lg'
                                                : 'hover:bg-slate-700/50 hover:shadow-md border border-transparent'
                                            }`}
                                    >
                                        <button
                                            onClick={() => handleSelect(item)}
                                            className="flex items-center space-x-3 text-white flex-1 text-left min-w-0"
                                        >
                                            {getFileIcon(item)}
                                            <span className="truncate font-medium text-sm">
                                                {item.name}
                                            </span>
                                            {item.type === 'folder' && (
                                                <span className="text-xs text-slate-400 ml-auto mr-2">
                                                    folder
                                                </span>
                                            )}
                                        </button>
                                        <button
                                            onClick={(e) => handleDelete(item, e)}
                                            title="Delete"
                                            className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 hover:bg-red-500/20 p-2 rounded-lg transition-all duration-200"
                                        >
                                            <TrashIcon size={16} />
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            {/* Create New Item */}
            <div className="bg-slate-800/50 border-t border-slate-600/50 p-4">
                <div className="space-y-3">
                    {selectedPath && (
                        <div className="text-xs text-slate-400">
                            Creating in: {selectedPath === '/' ? 'Root' : selectedPath}
                        </div>
                    )}
                    <div className="flex items-center space-x-2">
                        <input
                            type="text"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="Enter name..."
                            className="flex-1 px-3 py-2 rounded-lg bg-slate-700/50 border border-slate-600/50 text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400/50 transition-all"
                        />
                        <select
                            value={newType}
                            onChange={e => setNewType(e.target.value)}
                            className="px-3 py-2 rounded-lg bg-slate-700/50 border border-slate-600/50 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400/50 transition-all"
                        >
                            <option value="file">📄 File</option>
                            <option value="folder">📁 Folder</option>
                        </select>
                    </div>
                    <button
                        onClick={handleCreate}
                        disabled={!newName.trim() || isLoading}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl disabled:shadow-none"
                    >
                        <PlusIcon size={16} />
                        Create {newType}
                    </button>
                </div>
            </div>
        </div>
    );
}