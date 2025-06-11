import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Home = () => {
    const [roomId, setRoomId] = useState('');
    const [showJoinForm, setShowJoinForm] = useState(false);
    const navigate = useNavigate();

    const generateRoomId = () => {
        const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 8; i++) {
            result += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return result;
    };

    const createNewRoom = () => {
        const newRoomId = generateRoomId();
        navigate(`/room/${newRoomId}`);
    };

    const joinRoom = () => {
        if (roomId.trim()) {
            navigate(`/room/${roomId.trim()}`);
        }
    };

    const handleJoinInputChange = (e) => {
        setRoomId(e.target.value);
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            joinRoom();
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
            <div className="max-w-md w-full mx-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
                    <div className="mb-8">
                        <div className="text-6xl mb-4">👥</div>
                        <h1 className="text-3xl font-bold text-gray-800 mb-2">
                            Collaborative Code Editor
                        </h1>
                        <p className="text-gray-600">
                            Write code together in real-time with your team
                        </p>
                    </div>

                    <div className="space-y-4">
                        <button
                            onClick={createNewRoom}
                            className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg"
                        >
                            <div className="flex items-center justify-center space-x-2">
                                <span className="text-xl">🚀</span>
                                <span>Create New Room</span>
                            </div>
                        </button>

                        <div className="flex items-center space-x-4">
                            <div className="flex-1 h-px bg-gray-300"></div>
                            <span className="text-gray-500 text-sm">or</span>
                            <div className="flex-1 h-px bg-gray-300"></div>
                        </div>

                        {!showJoinForm ? (
                            <button
                                onClick={() => setShowJoinForm(true)}
                                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-4 px-6 rounded-xl transition-all duration-200 border-2 border-gray-200 hover:border-gray-300"
                            >
                                <div className="flex items-center justify-center space-x-2">
                                    <span className="text-xl">🔗</span>
                                    <span>Join Existing Room</span>
                                </div>
                            </button>
                        ) : (
                            <div className="space-y-3">
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={roomId}
                                        onChange={handleJoinInputChange}
                                        onKeyPress={handleKeyPress}
                                        placeholder="Enter room ID"
                                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none transition-colors text-center font-mono text-lg"
                                        autoFocus
                                    />
                                </div>
                                <div className="flex space-x-2">
                                    <button
                                        onClick={joinRoom}
                                        disabled={!roomId.trim()}
                                        className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200"
                                    >
                                        Join Room
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowJoinForm(false);
                                            setRoomId('');
                                        }}
                                        className="px-4 py-3 text-gray-500 hover:text-gray-700 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mt-8 pt-6 border-t border-gray-200">
                        <div className="text-sm text-gray-500 space-y-2">
                            <p className="flex items-center justify-center space-x-2">
                                <span>💡</span>
                                <span>Supports JavaScript, Python, C, and C++</span>
                            </p>
                            <p className="flex items-center justify-center space-x-2">
                                <span>⚡</span>
                                <span>Real-time collaboration with live execution</span>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Home;