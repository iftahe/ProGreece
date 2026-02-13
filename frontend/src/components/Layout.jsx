import React, { useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import {
    DashboardIcon, TransactionsIcon, ProjectsIcon, ApartmentsIcon,
    BudgetIcon, MenuIcon, CloseIcon, PortfolioIcon, SettingsIcon,
    ChevronDownIcon, ChevronRightIcon,
} from './Icons';
import { useProject } from '../contexts/ProjectContext';
import { cn } from '../lib/utils';

const portfolioNav = [
    { name: 'Portfolio Overview', href: '/', icon: PortfolioIcon },
];

const projectNav = [
    { name: 'Dashboard', href: '/dashboard', icon: DashboardIcon },
    { name: 'Apartments', href: '/apartments', icon: ApartmentsIcon },
    { name: 'Budget', href: '/budget-report', icon: BudgetIcon },
    { name: 'Transactions', href: '/transactions', icon: TransactionsIcon },
];

const adminNav = [
    { name: 'Projects', href: '/projects', icon: ProjectsIcon },
];

const SectionLabel = ({ children }) => (
    <p className="px-3 pt-5 pb-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
        {children}
    </p>
);

const NavLink = ({ item, isActive, onClick, searchParams }) => {
    const Icon = item.icon;
    // Preserve project query param when navigating
    const projectParam = searchParams?.get('project');
    const href = projectParam ? `${item.href}?project=${projectParam}` : item.href;

    return (
        <Link
            to={href}
            onClick={onClick}
            className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                    ? 'bg-sidebar-active text-white'
                    : 'text-slate-300 hover:bg-sidebar-hover hover:text-white'
            )}
        >
            <Icon className="w-5 h-5 flex-shrink-0" />
            {item.name}
        </Link>
    );
};

const SidebarContent = ({ onLinkClick }) => {
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const { projects, selectedProjectId, selectProject } = useProject();

    const isActive = (href) => location.pathname === href;

    return (
        <div className="flex flex-col h-full bg-sidebar">
            {/* Branding */}
            <div className="flex items-center gap-3 px-5 py-5 border-b border-white/8">
                <div className="w-9 h-9 rounded-lg bg-primary-500 flex items-center justify-center shadow-lg shadow-primary-500/20">
                    <span className="text-white font-bold text-lg">P</span>
                </div>
                <div>
                    <span className="text-white text-lg font-bold tracking-tight block leading-tight">ProGreece</span>
                    <span className="text-slate-400 text-[10px] font-medium tracking-wide uppercase">Financial Management</span>
                </div>
            </div>

            <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
                {/* Portfolio section */}
                <SectionLabel>{'Portfolio'}</SectionLabel>
                {portfolioNav.map(item => (
                    <NavLink key={item.href} item={item} isActive={isActive(item.href)} onClick={onLinkClick} searchParams={searchParams} />
                ))}

                {/* Project section */}
                <SectionLabel>{'Project'}</SectionLabel>

                {/* Project selector */}
                {projects.length > 0 && (
                    <div className="px-1 pb-1">
                        <div className="relative">
                            <select
                                value={selectedProjectId || ''}
                                onChange={(e) => selectProject(Number(e.target.value))}
                                className="w-full bg-sidebar-hover text-white text-sm rounded-lg pl-3 pr-8 py-2.5 border border-white/10 focus:outline-none focus:border-primary-400 appearance-none cursor-pointer font-medium"
                            >
                                {projects.map(p => (
                                    <option key={p.id} value={p.id} className="bg-sidebar text-white">
                                        {p.name}
                                    </option>
                                ))}
                            </select>
                            <ChevronDownIcon className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                    </div>
                )}

                {projectNav.map(item => (
                    <NavLink key={item.href} item={item} isActive={isActive(item.href)} onClick={onLinkClick} searchParams={searchParams} />
                ))}

                {/* Admin section */}
                <SectionLabel>{'Management'}</SectionLabel>
                {adminNav.map(item => (
                    <NavLink key={item.href} item={item} isActive={isActive(item.href)} onClick={onLinkClick} searchParams={searchParams} />
                ))}
            </nav>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-white/10">
                <p className="text-slate-500 text-xs">{'Greece Real Estate Management'}</p>
            </div>
        </div>
    );
};

const Breadcrumbs = () => {
    const location = useLocation();
    const { selectedProject } = useProject();

    const pathMap = {
        '/': 'Portfolio Overview',
        '/dashboard': 'Dashboard',
        '/apartments': 'Apartments',
        '/budget-report': 'Budget',
        '/transactions': 'Transactions',
        '/projects': 'Projects',
    };

    const currentPage = pathMap[location.pathname] || '';
    const isProjectScoped = ['/dashboard', '/apartments', '/budget-report', '/transactions'].includes(location.pathname);

    return (
        <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-4">
            <span className="font-medium text-gray-400">ProGreece</span>
            {isProjectScoped && selectedProject && (
                <>
                    <ChevronRightIcon className="w-3.5 h-3.5 text-gray-300" />
                    <span className="text-gray-400">{selectedProject.name}</span>
                </>
            )}
            <ChevronRightIcon className="w-3.5 h-3.5 text-gray-300" />
            <span className="font-medium text-gray-700">{currentPage}</span>
        </div>
    );
};

const Layout = ({ children }) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="min-h-screen bg-gray-50">
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
                            <Breadcrumbs />
                            {children}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default Layout;