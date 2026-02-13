import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { DashboardIcon, TransactionsIcon, ProjectsIcon, ApartmentsIcon, BudgetIcon, MenuIcon, CloseIcon } from './Icons';
import { cn } from '../lib/utils';

const navigation = [
    { name: 'Dashboard', href: '/', icon: DashboardIcon },
    { name: 'Transactions', href: '/transactions', icon: TransactionsIcon },
    { name: 'Projects', href: '/projects', icon: ProjectsIcon },
    { name: 'Apartments', href: '/apartments', icon: ApartmentsIcon },
    { name: 'Budget Report', href: '/budget-report', icon: BudgetIcon },
];

const SidebarContent = ({ onLinkClick }) => {
    const location = useLocation();

    return (
        <div className="flex flex-col h-full bg-sidebar">
            {/* Branding */}
            <div className="flex items-center gap-3 px-5 py-6 border-b border-white/10">
                <div className="w-9 h-9 rounded-lg bg-primary-500 flex items-center justify-center">
                    <span className="text-white font-bold text-lg">P</span>
                </div>
                <span className="text-white text-xl font-bold tracking-tight">ProGreece</span>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 space-y-1">
                {navigation.map((item) => {
                    const isActive = location.pathname === item.href;
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.name}
                            to={item.href}
                            onClick={onLinkClick}
                            className={cn(
                                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                                isActive
                                    ? 'bg-sidebar-active text-white'
                                    : 'text-slate-300 hover:bg-sidebar-hover hover:text-white'
                            )}
                        >
                            <Icon className="w-5 h-5 flex-shrink-0" />
                            {item.name}
                        </Link>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-white/10">
                <p className="text-slate-500 text-xs">Real Estate Management</p>
            </div>
        </div>
    );
};

const Layout = ({ children }) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Desktop sidebar */}
            <div className="hidden md:fixed md:inset-y-0 md:left-0 md:z-30 md:flex md:w-64 md:flex-col">
                <SidebarContent />
            </div>

            {/* Mobile overlay */}
            {sidebarOpen && (
                <div className="fixed inset-0 z-40 md:hidden">
                    <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
                    <div className="fixed inset-y-0 left-0 z-50 w-64 flex flex-col">
                        <SidebarContent onLinkClick={() => setSidebarOpen(false)} />
                    </div>
                    <button
                        className="fixed top-4 left-[17rem] z-50 p-1 rounded-full bg-sidebar text-white"
                        onClick={() => setSidebarOpen(false)}
                    >
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>
            )}

            {/* Mobile header */}
            <div className="md:hidden fixed top-0 left-0 right-0 z-20 bg-white border-b border-gray-200 h-14 flex items-center px-4 gap-3">
                <button
                    onClick={() => setSidebarOpen(true)}
                    className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100"
                >
                    <MenuIcon />
                </button>
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-md bg-primary-500 flex items-center justify-center">
                        <span className="text-white font-bold text-sm">P</span>
                    </div>
                    <span className="font-bold text-gray-900">ProGreece</span>
                </div>
            </div>

            {/* Main content */}
            <div className="flex flex-col flex-1 md:pl-64">
                <main className="flex-1 pt-14 md:pt-0">
                    <div className="py-6">
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
                            {children}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default Layout;
