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
    const [language, setLanguage] = useState('javascript');
    const [isExecuting, setIsExecuting] = useState(false);
    const [terminalContent, setTerminalContent] = useState('$ Ready to execute code...\n');
    const [isConnected, setIsConnected] = useState(false);
    const wsRef = useRef(null);
    const isExplicitClose = useRef(false);

    useEffect(() => {
        const ydoc = new Y.Doc();

        const provider = new HocuspocusProvider({
            url: 'ws://localhost:1234',
            name: roomId,
            document: ydoc,
            token: 'your-secure-token', // Add authentication token
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
                setTerminalContent(prev => prev + 'Connected to execution service\n$ ');
            };

            wsRef.current.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    switch (data.type) {
                        case 'system':
                            setTerminalContent(prev => prev + data.data + '\n$ ');
                            break;
                        case 'output':
                            setTerminalContent(prev => prev + data.data);
                            break;
                        case 'end':
                            setTerminalContent(prev => prev + '\n' + data.data + '\n$ ');
                            setIsExecuting(false);
                            break;
                        case 'error':
                            setTerminalContent(prev => prev + '\nERROR: ' + data.data + '\n$ ');
                            setIsExecuting(false);
                            break;
                        default:
                            setTerminalContent(prev => prev + '\nUnknown message: ' + event.data + '\n$ ');
                    }
                } catch (err) {
                    setTerminalContent(prev => prev + '\nFailed to parse message: ' + event.data + '\n$ ');
                }
            };

            wsRef.current.onerror = (error) => {
                setTerminalContent(prev => prev + '\nConnection error: ' + error.message + '\n$ ');
                setIsConnected(false);
                setIsExecuting(false);
            };

            wsRef.current.onclose = () => {
                if (!isExplicitClose.current) {
                    setTerminalContent(prev => prev + '\nConnection closed. Reconnecting...\n$ ');
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
        setTerminalContent(prev => prev + '$ Executing...\n');

        try {
            const code = editorRef.current.querySelector('.cm-content').textContent;
            wsRef.current.send(JSON.stringify({
                code,
                language,
                sessionId: roomId
            }));
        } catch (err) {
            setTerminalContent(prev => prev + '\nFailed to get code: ' + err.message + '\n$ ');
            setIsExecuting(false);
        }
    };

    const clearTerminal = () => {
        setTerminalContent('$ Terminal cleared\n$ ');
    };

    return (
        <div className="space-y-4">
            <h3 className="text-center text-red-700">Collaborative Code Editor</h3>

            <div className="flex space-x-4 items-center">
                <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="border rounded px-2 py-1"
                >
                    <option value="javascript">JavaScript</option>
                    <option value="python">Python</option>
                    <option value="html">HTML</option>
                </select>

                <button
                    onClick={executeCode}
                    disabled={isExecuting || !isConnected}
                    className="bg-blue-500 text-white px-4 py-1 rounded disabled:bg-blue-300"
                    title={!isConnected ? "Not connected to execution service" : ""}
                >
                    {isExecuting ? 'Executing...' : 'Run Code'}
                </button>

                <button
                    onClick={clearTerminal}
                    className="bg-gray-500 text-white px-4 py-1 rounded"
                >
                    Clear Terminal
                </button>

                <div className={`h-3 w-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}
                    title={isConnected ? "Connected to execution service" : "Disconnected from execution service"}>
                </div>
            </div>

            <div ref={editorRef} className='h-[400px] border rounded overflow-auto' />

            <div className="space-y-2">
                <h4 className="font-medium">Terminal Output</h4>
                <pre
                    className="h-48 bg-black text-green-400 p-2 font-mono text-sm overflow-auto whitespace-pre-wrap"
                >
                    {terminalContent}
                </pre>
            </div>
        </div>
    );
};

export default CodeEditor;