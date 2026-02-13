import React from 'react';
import { cn } from '../lib/utils';

const ConfirmDialog = ({ open, title, message, onConfirm, onCancel, variant = 'danger' }) => {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50" onClick={onCancel} />
            <div className="relative card-modal p-6 max-w-md w-full mx-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-600 mb-6">{message}</p>
                <div className="flex justify-end gap-3">
                    <button onClick={onCancel} className="btn-secondary">
                        {'Cancel'}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={cn(
                            'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors',
                            variant === 'danger' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-primary-600 hover:bg-primary-700'
                        )}
                    >
                        {'Confirm'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDialog;