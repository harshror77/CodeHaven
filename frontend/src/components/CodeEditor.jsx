import React, { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { cpp } from '@codemirror/lang-cpp';
import { yCollab } from 'y-codemirror.next';

const languageExtensions = {
    javascript: javascript(),
    python: python(),
    c: cpp(), // C uses same syntax highlighting as C++
    cpp: cpp()
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
        addToTerminal(`Starting ${language.toUpperCase()} execution...`, 'system');

        try {
            const rawCode = Array.from(editorRef.current.querySelectorAll('.cm-line'))
                .map(line => line.textContent)
                .join('\n');

            console.log('Raw code:', rawCode);
            if (!rawCode.trim()) {
                addToTerminal('No code to execute', 'error');
                setIsExecuting(false);
                return;
            }

            const processedCode = rawCode;
            console.log('Original code:', rawCode);
            console.log('Processed code:', processedCode);

            wsRef.current.send(JSON.stringify({
                code: processedCode,
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
        <div className="space-y-4">
            <h3 className="text-center text-red-700 font-bold">Collaborative Code Editor</h3>

            <div className="flex space-x-4 items-center flex-wrap gap-2">
                <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="border rounded px-3 py-2 bg-white min-w-[120px]"
                >
                    <option value="javascript">JavaScript</option>
                    <option value="python">Python</option>
                    <option value="c">C</option>
                    <option value="cpp">C++</option>
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
                <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-gray-700">Terminal Output</h4>
                    <span className="text-sm text-gray-500">
                        Language: {getLanguageDisplayName(language)}
                    </span>
                </div>
                <div
                    ref={terminalRef}
                    className="h-48 bg-gray-900 text-green-400 p-3 font-mono text-sm overflow-auto rounded shadow-inner"
                >
                    {terminalContent.length === 0 ? (
                        <div className="text-gray-500">💻 Ready to execute code...</div>
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
        </div>
    );
};

export default CodeEditor;