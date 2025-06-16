import React, { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { cpp } from '@codemirror/lang-cpp';
import { yCollab } from 'y-codemirror.next';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { keymap } from '@codemirror/view';
import { indentWithTab } from '@codemirror/commands';

const api = axios.create({
    baseURL: 'http://localhost:3000/api',
    headers: {
        'Content-Type': 'application/json',
    }
});

const languageExtensions = {
    javascript: javascript(),
    python: python(),
    c: cpp(), // C uses same syntax highlighting as C++
    cpp: cpp()
};

const CodeEditor = () => {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const editorRef = useRef(null);
    const terminalRef = useRef(null);
    const editorViewRef = useRef(null);
    const ytextRef = useRef(null);
    const [language, setLanguage] = useState('javascript');
    const [isExecuting, setIsExecuting] = useState(false);
    const [terminalContent, setTerminalContent] = useState([]);
    const [isConnected, setIsConnected] = useState(false);
    const wsRef = useRef(null);
    const isExplicitClose = useRef(false);
    const [copied, setCopied] = useState(false);
    const [isLeaving, setIsLeaving] = useState(false);
    const [showLeaveModal, setShowLeaveModal] = useState(false);

    // Generate a simple user ID (in a real app, this would come from authentication)
    const userId = `user-${Math.random().toString(36).substr(2, 9)}`;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(roomId);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000); // Reset after 2s
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const leaveRoom = async () => {
        setIsLeaving(true);
        try {
            const response = await api.post(`/rooms/${roomId}/leave`, {
                userId: userId
            });

            if (response.data.success) {
                // Close WebSocket connections
                isExplicitClose.current = true;
                if (wsRef.current) {
                    wsRef.current.close();
                }

                // Navigate back to home/room selection
                navigate('/start');
            } else {
                addToTerminal(`Failed to leave room: ${response.data.message}`, 'error');
            }
        } catch (error) {
            console.error('Error leaving room:', error);
            addToTerminal('Error leaving room. Please try again.', 'error');
        } finally {
            setIsLeaving(false);
            setShowLeaveModal(false);
        }
    };

    const addToTerminal = (message, type = 'info') => {
        const timestamp = new Date().toLocaleTimeString();
        setTerminalContent(prev => [...prev, { message, type, timestamp }]);
    };

    const formatTerminalLine = (item) => {
        if (item.type === 'error' && item.message.includes('Line ')) {
            return {
                icon: '🛠️',
                color: 'text-yellow-400',
                text: item.message.replace(/Line (\d+)/, (_, line) => `Line ${line}:`)
            };
        }
        const icons = {
            system: '🔧',
            output: '📤',
            error: '❌',
            info: 'ℹ️',
            success: '✅'
        };

        const colors = {
            system: 'text-blue-400',
            output: 'text-green-400',
            error: 'text-red-400',
            info: 'text-gray-300',
            success: 'text-green-500'
        };

        return {
            icon: icons[item.type] || 'ℹ️',
            color: colors[item.type] || 'text-gray-300',
            text: item.message
        };
    };

    // Function to clean code for execution
    const cleanCodeForExecution = (code) => {
        if (!code) return '';

        // Remove any non-printable characters except for standard whitespace
        // Keep: spaces, tabs, newlines, carriage returns
        const cleanedCode = code.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, '');

        // Normalize line endings to \n
        const normalizedCode = cleanedCode.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

        // Remove any zero-width characters or invisible characters
        const finalCode = normalizedCode.replace(/[\u200B-\u200D\uFEFF]/g, '');

        return finalCode;
    };

    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [terminalContent]);

    useEffect(() => {
        const ydoc = new Y.Doc();
        const provider = new HocuspocusProvider({
            // url: import.meta.env.VITE_HOCUSPOCUS_API_URL,
            url: 'ws://localhost:1234',
            name: roomId,
            document: ydoc,
            // parameters: {
            //     token: 'dummy-token'
            // }
        });

        const ytext = ydoc.getText('codemirror');
        ytextRef.current = ytext;

        const state = EditorState.create({
            doc: ytext.toString(),
            extensions: [
                basicSetup,
                languageExtensions[language],
                yCollab(ytext, provider.awareness),
                // Add tab support
                keymap.of([indentWithTab]),
                // Configure tab size
                EditorState.tabSize.of(4),
                // Enable tab handling
                EditorView.theme({
                    '.cm-editor': {
                        fontSize: '14px',
                        fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace'
                    },
                    '.cm-focused': {
                        outline: 'none'
                    },
                    '.cm-editor.cm-focused': {
                        outline: 'none'
                    }
                })
            ]
        });

        const view = new EditorView({
            state,
            parent: editorRef.current
        });

        editorViewRef.current = view;

        const connectWebSocket = () => {
            if (wsRef.current) {
                wsRef.current.close();
            }

            wsRef.current = new WebSocket('ws://localhost:8080');

            wsRef.current.onopen = () => {
                setIsConnected(true);
                addToTerminal('Connected to execution service', 'system');
            };

            wsRef.current.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);

                    switch (data.type) {
                        case 'system':
                            addToTerminal(data.data, 'system');
                            break;
                        case 'output':
                            if (data.data && data.data.trim()) {
                                // Clean the output data and add to terminal
                                const cleanOutput = data.data.trim();
                                addToTerminal(cleanOutput, 'output');
                            }
                            break;
                        case 'end':
                            addToTerminal(data.data, 'success');
                            setIsExecuting(false);
                            break;
                        case 'error':
                            if (data.data && data.data.trim()) {
                                const cleanError = data.data.trim();
                                addToTerminal(cleanError, 'error');
                            }
                            setIsExecuting(false);
                            break;
                        default:
                            addToTerminal(`Unknown message: ${data.data}`, 'error');
                    }
                } catch (err) {
                    addToTerminal(`Parse error: ${event.data}`, 'error');
                }
            };

            wsRef.current.onerror = (error) => {
                addToTerminal('WebSocket connection error occurred', 'error');
                setIsConnected(false);
                setIsExecuting(false);
            };

            wsRef.current.onclose = () => {
                if (!isExplicitClose.current) {
                    addToTerminal('Connection lost. Attempting to reconnect...', 'error');
                    setTimeout(connectWebSocket, 3000);
                }
                setIsConnected(false);
                setIsExecuting(false);
            };
        };

        connectWebSocket();

        return () => {
            isExplicitClose.current = true;

            if (editorViewRef.current) {
                editorViewRef.current.destroy();
            }

            if (provider && provider.ws && (
                provider.ws.readyState === WebSocket.CONNECTING ||
                provider.ws.readyState === WebSocket.OPEN
            )) {
                provider.destroy();
            }

            ydoc.destroy();

            if (wsRef.current && (
                wsRef.current.readyState === WebSocket.CONNECTING ||
                wsRef.current.readyState === WebSocket.OPEN
            )) {
                wsRef.current.close();
            }
        };

    }, [roomId, language]);

    const executeCode = () => {
        if (isExecuting || !isConnected) {
            return;
        }

        setIsExecuting(true);
        addToTerminal(`Starting ${language.toUpperCase()} execution...`, 'system');

        try {
            // Get the raw code from the Yjs document
            const rawCode = ytextRef.current ? ytextRef.current.toString() : '';

            // Clean the code for execution
            const cleanCode = cleanCodeForExecution(rawCode);

            console.log('Raw code from Yjs:', rawCode);
            console.log('Cleaned code for execution:', cleanCode);

            if (!cleanCode.trim()) {
                addToTerminal('No code to execute', 'error');
                setIsExecuting(false);
                return;
            }

            // Send the cleaned code
            wsRef.current.send(JSON.stringify({
                code: cleanCode,
                language,
                sessionId: roomId
            }));
        } catch (err) {
            addToTerminal(`Failed to execute: ${err.message}`, 'error');
            setIsExecuting(false);
        }
    };

    const clearTerminal = () => {
        setTerminalContent([]);
        addToTerminal('Terminal cleared', 'system');
    };

    const getLanguageDisplayName = (lang) => {
        const names = {
            javascript: 'JavaScript',
            python: 'Python',
            c: 'C',
            cpp: 'C++'
        };
        return names[lang] || lang;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 mb-6 p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex items-center space-x-4">
                            <h1 className="text-3xl font-bold text-white">
                                Code<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">Haven</span>
                            </h1>
                            <div className="flex items-center space-x-2">
                                <div className={`h-3 w-3 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'} animate-pulse`} />
                                <span className="text-white font-medium">
                                    {isConnected ? 'Connected' : 'Disconnected'}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 p-3 bg-white/10 rounded-xl border border-white/20">
                                <span className="text-white font-mono text-sm">Room: {roomId}</span>
                                <button
                                    onClick={handleCopy}
                                    className="px-3 py-1 text-xs font-semibold text-white bg-gradient-to-r from-cyan-500 to-purple-600 rounded-lg hover:from-cyan-400 hover:to-purple-500 transition-all duration-200"
                                >
                                    {copied ? 'Copied!' : 'Copy ID'}
                                </button>
                            </div>

                            <button
                                onClick={() => setShowLeaveModal(true)}
                                disabled={isLeaving}
                                className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 hover:text-white border border-red-500/50 hover:border-red-400 rounded-xl font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <div className="flex items-center space-x-2">
                                    <span>🚪</span>
                                    <span>{isLeaving ? 'Leaving...' : 'Leave Room'}</span>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Controls */}
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 mb-6 p-6">
                    <div className="flex flex-wrap items-center gap-4">
                        <select
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                            className="bg-white/10 border border-white/30 rounded-xl px-4 py-2 text-white font-medium min-w-[140px] focus:border-cyan-400 focus:outline-none transition-colors"
                        >
                            <option value="javascript" className="bg-gray-800">JavaScript</option>
                            <option value="python" className="bg-gray-800">Python</option>
                            <option value="c" className="bg-gray-800">C</option>
                            <option value="cpp" className="bg-gray-800">C++</option>
                        </select>

                        <button
                            onClick={executeCode}
                            disabled={isExecuting || !isConnected}
                            className={`px-6 py-2 rounded-xl font-medium transition-all duration-200 transform hover:scale-105 ${isExecuting || !isConnected
                                ? 'bg-gray-500/50 text-gray-400 cursor-not-allowed'
                                : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white shadow-lg'
                                }`}
                            title={!isConnected ? "Not connected to execution service" : ""}
                        >
                            <div className="flex items-center space-x-2">
                                <span>{isExecuting ? '⏳' : '▶️'}</span>
                                <span>{isExecuting ? 'Running...' : 'Run Code'}</span>
                            </div>
                        </button>

                        <button
                            onClick={clearTerminal}
                            className="bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded-xl font-medium transition-all duration-200 border border-white/30 hover:border-white/50"
                        >
                            <div className="flex items-center space-x-2">
                                <span>🗑️</span>
                                <span>Clear Terminal</span>
                            </div>
                        </button>

                        <div className="ml-auto text-sm text-cyan-300 font-medium">
                            Language: {getLanguageDisplayName(language)}
                        </div>
                    </div>
                </div>

                {/* Code Editor */}
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 mb-6 overflow-hidden">
                    <div className="bg-white/5 p-4 border-b border-white/20">
                        <h3 className="text-white font-semibold flex items-center gap-2">
                            Code Editor

                        </h3>
                    </div>
                    <div ref={editorRef} className="h-[400px] overflow-auto" />
                </div>

                {/* Terminal */}
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 overflow-hidden">
                    <div className="bg-white/5 p-4 border-b border-white/20">
                        <h4 className="font-semibold text-white">Terminal Output</h4>
                    </div>
                    <div
                        ref={terminalRef}
                        className="h-48 bg-gray-900/80 text-green-400 p-4 font-mono text-sm overflow-auto"
                    >
                        {terminalContent.length === 0 ? (
                            <div className="text-gray-500 flex items-center space-x-2">
                                <span>💻</span>
                                <span>Ready to execute code...</span>
                            </div>
                        ) : (
                            terminalContent.map((item, index) => {
                                const formatted = formatTerminalLine(item);
                                return (
                                    <div
                                        key={index}
                                        className={`mb-1 ${formatted.color} flex items-start space-x-2`}
                                    >
                                        <span className="text-xs text-gray-500 min-w-[60px]">
                                            {item.timestamp}
                                        </span>
                                        <span className="flex-shrink-0">
                                            {formatted.icon}
                                        </span>
                                        <span className="break-all">
                                            {formatted.text}
                                        </span>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Leave Room Modal */}
                {showLeaveModal && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 p-6 max-w-md w-full">
                            <div className="text-center">
                                <div className="text-4xl mb-4">🚪</div>
                                <h3 className="text-xl font-bold text-white mb-2">Leave Room?</h3>
                                <p className="text-gray-300 mb-6">
                                    Are you sure you want to leave this coding session?
                                    Your progress will be saved but you'll need the room ID to rejoin.
                                </p>
                                <div className="flex space-x-3">
                                    <button
                                        onClick={() => setShowLeaveModal(false)}
                                        disabled={isLeaving}
                                        className="flex-1 bg-white/10 hover:bg-white/20 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 border border-white/30 hover:border-white/50 disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={leaveRoom}
                                        disabled={isLeaving}
                                        className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isLeaving ? 'Leaving...' : 'Leave Room'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CodeEditor;