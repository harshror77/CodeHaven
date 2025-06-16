import React from 'react';
import { Link } from 'react-router-dom';
const Home = () => {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
            <div className="text-center">
                <div className="mb-12">
                    <h1 className="text-7xl md:text-8xl font-bold text-white mb-6">
                        Code<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">Lab</span>
                    </h1>
                    <p className="text-xl md:text-2xl text-gray-300 font-light">
                        Collaborative coding made simple
                    </p>
                </div>

                <Link to="/start" className="inline-block bg-gradient-to-r from-cyan-400 to-purple-400 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:from-cyan-500 hover:to-purple-500 transition-colors">
                    Create a Room<button
                        className="group relative px-12 py-6 text-2xl font-semibold text-white bg-gradient-to-r from-cyan-500 to-purple-600 rounded-full hover:from-cyan-400 hover:to-purple-500 transform hover:scale-105 transition-all duration-300 shadow-2xl hover:shadow-cyan-500/25"
                    >
                        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-400 to-purple-400 opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
                        <div className="relative flex items-center space-x-3">
                            <span>Start Coding</span>
                            <svg className="w-6 h-6 transform group-hover:translate-x-1 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                        </div>
                    </button>
                </Link>

                <div className="mt-16 flex justify-center space-x-8 text-gray-400">
                    <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                        <span>Real-time</span>
                    </div>
                    <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                        <span>Multi-language</span>
                    </div>
                    <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                        <span>Instant setup</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Home;