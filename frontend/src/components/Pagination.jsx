import React from 'react';
import { cn } from '../lib/utils';

const Pagination = ({ total, skip, limit, onPageChange }) => {
    if (total <= limit) return null;

    const currentPage = Math.floor(skip / limit) + 1;
    const totalPages = Math.ceil(total / limit);

    const goToPage = (page) => {
        onPageChange((page - 1) * limit);
    };

    const getPageNumbers = () => {
        const pages = [];
        const maxVisible = 5;
        let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
        let end = Math.min(totalPages, start + maxVisible - 1);
        if (end - start < maxVisible - 1) {
            start = Math.max(1, end - maxVisible + 1);
        }
        for (let i = start; i <= end; i++) {
            pages.push(i);
        }
        return pages;
    };

    return (
        <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">
                Showing {skip + 1}-{Math.min(skip + limit, total)} of {total}
            </p>
            <div className="flex items-center gap-1">
                <button
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={cn(
                        'px-3 py-1.5 text-sm rounded-lg transition-colors',
                        currentPage === 1
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-gray-600 hover:bg-gray-100'
                    )}
                >
                    Previous
                </button>
                {getPageNumbers().map(page => (
                    <button
                        key={page}
                        onClick={() => goToPage(page)}
                        className={cn(
                            'w-8 h-8 text-sm rounded-lg transition-colors',
                            page === currentPage
                                ? 'bg-primary-600 text-white font-medium'
                                : 'text-gray-600 hover:bg-gray-100'
                        )}
                    >
                        {page}
                    </button>
                ))}
                <button
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className={cn(
                        'px-3 py-1.5 text-sm rounded-lg transition-colors',
                        currentPage === totalPages
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-gray-600 hover:bg-gray-100'
                    )}
                >
                    Next
                </button>
            </div>
        </div>
    );
};

export default Pagination;
