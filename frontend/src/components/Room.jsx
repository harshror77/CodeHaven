import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import CodeEditor from './CodeEditor';

const Room = () => {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const [showRoomInfo, setShowRoomInfo] = useState(false);

    const copyRoomId = () => {
        navigator.clipboard.writeText(roomId);
        setShowRoomInfo(true);
        setTimeout(() => setShowRoomInfo(false), 2000);
    };

    const leaveRoom = () => {
        navigate('/');
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center space-x-4">
                            <button
                                onClick={leaveRoom}
                                className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors"
                            >
                                <span className="text-xl">←</span>
                                <span className="font-medium">Back to Home</span>
                            </button>
                            <div className="h-6 w-px bg-gray-300"></div>
                            <h1 className="text-xl font-semibold text-gray-800">
                                Code Room
                            </h1>
                        </div>

                        <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2">
                                <span className="text-sm text-gray-600">Room ID:</span>
                                <code className="bg-gray-100 px-3 py-1 rounded-md font-mono text-sm text-gray-800">
                                    {roomId}
                                </code>
                                <button
                                    onClick={copyRoomId}
                                    className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md text-sm font-medium transition-colors"
                                    title="Copy Room ID"
                                >
                                    📋
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Copy notification */}
            {showRoomInfo && (
                <div className="fixed top-20 right-4 bg-green-500 text-white px-4 py-2 rounded-md shadow-lg z-50 animate-pulse">
                    Room ID copied to clipboard!
                </div>
            )}

            {/* Main content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <div className="bg-white rounded-lg shadow-sm p-6">
                    <CodeEditor roomId={roomId} />
                </div>
            </div>

            {/* Room info footer */}
            <div className="bg-white border-t mt-8">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between text-sm text-gray-500">
                        <div className="flex items-center space-x-6">
                            <span className="flex items-center space-x-1">
                                <span>👥</span>
                                <span>Share the room ID with your team to collaborate</span>
                            </span>
                            <span className="flex items-center space-x-1">
                                <span>💾</span>
                                <span>Your code is automatically synced in real-time</span>
                            </span>
                        </div>
                        <div className="text-xs text-gray-400">
                            Room: {roomId}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Room;