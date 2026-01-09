import React, { useState, useRef, useEffect } from 'react';
import { User, LogOut, RefreshCw, ChevronDown } from 'lucide-react';

interface UserMenuProps {
    userEmail: string | null;
    isOfflineMode: boolean;
    onSignOut: () => void;
    onSwitchAccount: () => void;
}

const UserMenu: React.FC<UserMenuProps> = ({ userEmail, isOfflineMode, onSignOut, onSwitchAccount }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isOfflineMode ? 'bg-gray-200' : 'bg-indigo-100'}`}>
                    <User className={`w-4 h-4 ${isOfflineMode ? 'text-gray-600' : 'text-indigo-600'}`} />
                </div>
                <div className="hidden sm:block text-left">
                    <p className="text-sm font-medium text-gray-700 truncate max-w-[120px]">
                        {isOfflineMode ? 'Guest Mode' : (userEmail || 'User')}
                    </p>
                    <p className="text-xs text-gray-400">
                        {isOfflineMode ? 'Offline' : 'Signed in'}
                    </p>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
                    {/* User Info Header */}
                    <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-sm font-medium text-gray-900 truncate">
                            {isOfflineMode ? 'Guest Mode' : userEmail}
                        </p>
                        <p className="text-xs text-gray-500">
                            {isOfflineMode ? 'Data stored locally' : 'Cloud sync enabled'}
                        </p>
                    </div>

                    {/* Menu Items */}
                    <div className="py-1">
                        {!isOfflineMode && (
                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    onSignOut();
                                }}
                                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                <LogOut className="w-4 h-4 text-gray-500" />
                                Sign Out
                            </button>
                        )}

                        <button
                            onClick={() => {
                                setIsOpen(false);
                                onSwitchAccount();
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                            <RefreshCw className="w-4 h-4 text-gray-500" />
                            {isOfflineMode ? 'Sign In' : 'Switch Account'}
                        </button>
                    </div>

                    {/* Offline Mode Warning */}
                    {isOfflineMode && (
                        <div className="px-4 py-2 border-t border-gray-100">
                            <p className="text-xs text-amber-600">
                                ⚠️ Sign in to sync your data across devices
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default UserMenu;
