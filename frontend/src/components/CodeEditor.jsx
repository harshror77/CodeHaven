import React, { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { html } from '@codemirror/lang-html';
import { yCollab } from 'y-codemirror.next';

const languageExtensions = {
    javascript: javascript(),
    python: python(),
    html: html()
};

const CodeEditor = ({ roomId }) => {
    const editorRef = useRef(null);
    const terminalRef = useRef(null);
    const [language, setLanguage] = useState('javascript');
    const [isExecuting, setIsExecuting] = useState(false);
    const [terminalContent, setTerminalContent] = useState([]);
    const [isConnected, setIsConnected] = useState(false);
    const wsRef = useRef(null);
    const isExplicitClose = useRef(false);

    const addToTerminal = (message, type = 'info') => {
        const timestamp = new Date().toLocaleTimeString();
        setTerminalContent(prev => [...prev, { message, type, timestamp }]);
    };

    const formatTerminalLine = (item) => {
        const prefix = {
            system: '🔧',
            output: '📤',
            error: '❌',
            info: 'ℹ️'
        }[item.type] || '';

        return `[${item.timestamp}] ${prefix} ${item.message}`;
    };

    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [terminalContent]);

    useEffect(() => {
        const ydoc = new Y.Doc();

        const provider = new HocuspocusProvider({
            url: 'ws://localhost:1234',
            name: roomId,
            document: ydoc,
            token: 'your-secure-token',
            parameters: {
                room: roomId
            }
        });

        const ytext = ydoc.getText('codemirror');

        const state = EditorState.create({
            doc: ytext.toString(),
            extensions: [
                basicSetup,
                languageExtensions[language],
                yCollab(ytext, provider.awareness),
            ]
        });

        const view = new EditorView({
            state,
            parent: editorRef.current
        });

        const connectWebSocket = () => {
            if (wsRef.current) {
                wsRef.current.close();
            }

            wsRef.current = new WebSocket('ws://localhost:8080');

            wsRef.current.onopen = () => {
                setIsConnected(true);
            };

            wsRef.current.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);

                    switch (data.type) {
                        case 'system':
                            addToTerminal(data.data, 'system');
                            break;
                        case 'output':
                            addToTerminal(data.data.trim(), 'output');
                            break;
                        case 'end':
                            addToTerminal(data.data, 'system');
                            setIsExecuting(false);
                            break;
                        case 'error':
                            addToTerminal(data.data, 'error');
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
                addToTerminal('Connection error occurred', 'error');
                setIsConnected(false);
                setIsExecuting(false);
            };

            wsRef.current.onclose = () => {
                if (!isExplicitClose.current) {
                    addToTerminal('Connection lost. Reconnecting...', 'error');
                    setTimeout(connectWebSocket, 3000);
                }
                setIsConnected(false);
                setIsExecuting(false);
            };
        };

        connectWebSocket();

        return () => {
            isExplicitClose.current = true;
            view.destroy();
            provider.destroy();
            ydoc.destroy();
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, [roomId, language]);

    const executeCode = () => {
        if (isExecuting || !isConnected) {
            return;
        }

        setIsExecuting(true);

        try {
            const code = editorRef.current.querySelector('.cm-content').textContent;

            if (!code.trim()) {
                addToTerminal('No code to execute', 'error');
                setIsExecuting(false);
                return;
            }

            wsRef.current.send(JSON.stringify({
                code,
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

    return (
        <div className="space-y-4">
            <h3 className="text-center text-red-700 font-bold">Collaborative Code Editor</h3>

            <div className="flex space-x-4 items-center">
                <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="border rounded px-3 py-2 bg-white"
                >
                    <option value="javascript">JavaScript</option>
                    <option value="python">Python</option>
                    <option value="html">HTML</option>
                </select>

                <button
                    onClick={executeCode}
                    disabled={isExecuting || !isConnected}
                    className={`px-4 py-2 rounded font-medium transition-colors ${isExecuting || !isConnected
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-500 hover:bg-blue-600 text-white'
                        }`}
                    title={!isConnected ? "Not connected to execution service" : ""}
                >
                    {isExecuting ? '⏳ Running...' : '▶️ Run Code'}
                </button>

                <button
                    onClick={clearTerminal}
                    className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded font-medium transition-colors"
                >
                    🗑️ Clear
                </button>

                <div className="flex items-center space-x-2">
                    <div className={`h-3 w-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="text-sm font-medium">
                        {isConnected ? 'Connected' : 'Disconnected'}
                    </span>
                </div>
            </div>

            <div ref={editorRef} className="h-[400px] border rounded overflow-auto shadow-sm" />

            <div className="space-y-2">
                <h4 className="font-semibold text-gray-700">Terminal Output</h4>
                <div
                    ref={terminalRef}
                    className="h-48 bg-gray-900 text-green-400 p-3 font-mono text-sm overflow-auto rounded shadow-inner"
                >
                    {terminalContent.length === 0 ? (
                        <div className="text-gray-500">💻 Ready to execute code...</div>
                    ) : (
                        terminalContent.map((item, index) => (
                            <div
                                key={index}
                                className={`mb-1 ${item.type === 'error' ? 'text-red-400' :
                                    item.type === 'system' ? 'text-blue-400' :
                                        item.type === 'output' ? 'text-green-400' : 'text-gray-300'
                                    }`}
                            >
                                {formatTerminalLine(item)}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default CodeEditor;