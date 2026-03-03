import React, { useState, useEffect } from 'react';
import { getCounterparties, createCounterparty, updateCounterparty, deleteCounterparty } from '../api';
import { PencilIcon, EmptyStateIcon } from '../components/Icons';
import { cn } from '../lib/utils';

const SkeletonCounterparties = () => (
    <div className="space-y-6">
        <div className="card overflow-hidden">
            <div className="px-6 py-4">
                <div className="skeleton h-6 w-48" />
            </div>
            <div className="px-6 space-y-3 pb-6">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="skeleton h-12 w-full rounded" />
                ))}
            </div>
        </div>
    </div>
);

const Modal = ({ isOpen, onClose, onSubmit, formData, onChange, saving, editingId }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-semibold text-gray-900">
                        {editingId ? 'Edit Counterparty' : 'Add Counterparty'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none"
                    >
                        &times;
                    </button>
                </div>

                <form onSubmit={onSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={onChange}
                            required
                            placeholder="Counterparty name"
                            className="input-field"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            VAT Number
                        </label>
                        <input
                            type="text"
                            name="vat_number"
                            value={formData.vat_number}
                            onChange={onChange}
                            placeholder="Optional VAT number"
                            className="input-field"
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className={cn(
                                'inline-flex justify-center py-2 px-5 text-sm font-semibold rounded-lg text-white shadow-sm transition-colors',
                                editingId
                                    ? 'bg-amber-600 hover:bg-amber-700'
                                    : 'bg-primary-600 hover:bg-primary-700',
                                saving && 'opacity-50 cursor-not-allowed'
                            )}
                        >
                            {saving ? 'Saving...' : (editingId ? 'Update' : 'Create')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const Counterparties = () => {
    const [counterparties, setCounterparties] = useState([]);
    const [initialLoading, setInitialLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [message, setMessage] = useState(null);
    const [error, setError] = useState(null);

    const initialFormState = { name: '', vat_number: '' };
    const [formData, setFormData] = useState(initialFormState);

    useEffect(() => {
        loadCounterparties();
    }, []);

    const loadCounterparties = async () => {
        setError(null);
        try {
            const data = await getCounterparties();
            setCounterparties(data);
        } catch (err) {
            console.error('Failed to load counterparties', err);
            setError('Failed to load counterparties. Please try again.');
        } finally {
            setInitialLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleOpenAdd = () => {
        setEditingId(null);
        setFormData(initialFormState);
        setModalOpen(true);
    };

    const handleEdit = (counterparty) => {
        setEditingId(counterparty.id);
        setFormData({
            name: counterparty.name || '',
            vat_number: counterparty.vat_number || '',
        });
        setModalOpen(true);
    };

    const handleClose = () => {
        setModalOpen(false);
        setEditingId(null);
        setFormData(initialFormState);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);

        try {
            const payload = {
                name: formData.name,
                vat_number: formData.vat_number || null,
            };

            if (editingId) {
                await updateCounterparty(editingId, payload);
                setMessage({ type: 'success', text: 'Counterparty updated successfully' });
            } else {
                await createCounterparty(payload);
                setMessage({ type: 'success', text: 'Counterparty created successfully' });
            }

            handleClose();
            await loadCounterparties();
        } catch (err) {
            console.error(err);
            setMessage({ type: 'error', text: 'Failed to save counterparty' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (counterparty) => {
        if (!window.confirm(`Delete counterparty "${counterparty.name}"? This action cannot be undone.`)) return;
        setMessage(null);
        try {
            await deleteCounterparty(counterparty.id);
            setMessage({ type: 'success', text: 'Counterparty deleted successfully' });
            await loadCounterparties();
        } catch (err) {
            console.error(err);
            setMessage({ type: 'error', text: 'Failed to delete counterparty' });
        }
    };

    if (initialLoading) return <SkeletonCounterparties />;

    return (
        <div className="space-y-6">
            <Modal
                isOpen={modalOpen}
                onClose={handleClose}
                onSubmit={handleSubmit}
                formData={formData}
                onChange={handleChange}
                saving={saving}
                editingId={editingId}
            />

            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Counterparties</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage vendors and service providers</p>
                </div>
                <button
                    onClick={handleOpenAdd}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg text-white bg-primary-600 hover:bg-primary-700 shadow-sm transition-colors"
                >
                    <span className="text-base leading-none">+</span>
                    Add Counterparty
                </button>
            </div>

            {/* Message Banner */}
            {message && (
                <div className={cn(
                    'p-4 rounded-lg text-sm font-medium',
                    message.type === 'success'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                )}>
                    {message.text}
                </div>
            )}

            {/* Error Banner */}
            {error && (
                <div className="p-4 rounded-lg text-sm font-medium bg-rose-50 text-rose-700 border border-rose-200">
                    {error}
                </div>
            )}

            {/* Table */}
            <div className="card overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">All Counterparties</h3>
                    <span className="text-sm text-gray-400">{counterparties.length} total</span>
                </div>

                {counterparties.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4">
                        <EmptyStateIcon className="w-16 h-16 text-gray-300 mb-4" />
                        <p className="text-gray-500 text-sm">No counterparties yet. Add your first one above.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">VAT Number</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm">
                                {counterparties.map((cp, index) => (
                                    <tr key={cp.id} className={cn('hover:bg-gray-50', index % 2 !== 0 && 'bg-slate-50/50')}>
                                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{cp.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">{cp.vat_number || '-'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <div className="flex items-center gap-1 justify-end">
                                                <button
                                                    onClick={() => handleEdit(cp)}
                                                    className="inline-flex items-center p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                                                    title="Edit Counterparty"
                                                >
                                                    <PencilIcon className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(cp)}
                                                    className="inline-flex items-center p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                                    title="Delete Counterparty"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Counterparties;
