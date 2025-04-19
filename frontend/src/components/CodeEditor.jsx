import React, { useEffect, useRef } from 'react';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider'; // ✅ use this
import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { yCollab } from 'y-codemirror.next';

const CodeEditor = ({ roomId }) => {
    const editorRef = useRef(null);

    useEffect(() => {
        const ydoc = new Y.Doc();

        const provider = new HocuspocusProvider({
            url: 'ws://localhost:1234',
            name: roomId, // room ID
            document: ydoc,
        });

        const ytext = ydoc.getText('codemirror');

        const state = EditorState.create({
            doc: '',
            extensions: [
                basicSetup,
                javascript(),
                yCollab(ytext, provider.awareness),
            ]
        });

        const view = new EditorView({
            state,
            parent: editorRef.current
        });

        return () => {
            view.destroy();
            provider.destroy();
            ydoc.destroy();
        };
    }, [roomId]);

    return (
        <div>
            <h3 className="text-algin:center text-red-700">Collaborative Code Editor</h3>
            <div ref={editorRef} className='h-[400px]' />
        </div>
    );
};

export default CodeEditor;
