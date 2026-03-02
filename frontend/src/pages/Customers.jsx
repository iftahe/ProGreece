import React, { useState, useEffect } from 'react';
import { getCustomers, createCustomer, updateCustomer, deleteCustomer } from '../api';
import { PencilIcon, EmptyStateIcon } from '../components/Icons';
import { cn } from '../lib/utils';

const SkeletonCustomers = () => (
    <div className="space-y-6">
        <div className="card overflow-hidden">
            <div className="px-6 py-4">
                <div className="skeleton h-6 w-40" />
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
                        {editingId ? 'Edit Customer' : 'Add Customer'}
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
                            Full Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                            type="text"
                            name="full_name"
                            value={formData.full_name}
                            onChange={onChange}
                            required
                            placeholder="Customer full name"
                            className="input-field"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Email
                        </label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={onChange}
                            placeholder="customer@example.com"
                            className="input-field"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Phone
                        </label>
                        <input
                            type="text"
                            name="phone"
                            value={formData.phone}
                            onChange={onChange}
                            placeholder="Optional phone number"
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

const Customers = () => {
    const [customers, setCustomers] = useState([]);
    const [initialLoading, setInitialLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [message, setMessage] = useState(null);
    const [error, setError] = useState(null);

    const initialFormState = { full_name: '', email: '', phone: '' };
    const [formData, setFormData] = useState(initialFormState);

    useEffect(() => {
        loadCustomers();
    }, []);

    const loadCustomers = async () => {
        setError(null);
        try {
            const data = await getCustomers();
            setCustomers(data);
        } catch (err) {
            console.error('Failed to load customers', err);
            setError('Failed to load customers. Please try again.');
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

    const handleEdit = (customer) => {
        setEditingId(customer.id);
        setFormData({
            full_name: customer.full_name || '',
            email: customer.email || '',
            phone: customer.phone || '',
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
                full_name: formData.full_name,
                email: formData.email || null,
                phone: formData.phone || null,
            };

            if (editingId) {
                await updateCustomer(editingId, payload);
                setMessage({ type: 'success', text: 'Customer updated successfully' });
            } else {
                await createCustomer(payload);
                setMessage({ type: 'success', text: 'Customer created successfully' });
            }

            handleClose();
            await loadCustomers();
        } catch (err) {
            console.error(err);
            setMessage({ type: 'error', text: 'Failed to save customer' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (customer) => {
        if (!window.confirm(`Delete customer "${customer.full_name}"? This action cannot be undone.`)) return;
        setMessage(null);
        try {
            await deleteCustomer(customer.id);
            setMessage({ type: 'success', text: 'Customer deleted successfully' });
            await loadCustomers();
        } catch (err) {
            console.error(err);
            setMessage({ type: 'error', text: 'Failed to delete customer' });
        }
    };

    if (initialLoading) return <SkeletonCustomers />;

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
                    <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage apartment buyers and clients</p>
                </div>
                <button
                    onClick={handleOpenAdd}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg text-white bg-primary-600 hover:bg-primary-700 shadow-sm transition-colors"
                >
                    <span className="text-base leading-none">+</span>
                    Add Customer
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
                    <h3 className="text-lg font-semibold text-gray-900">All Customers</h3>
                    <span className="text-sm text-gray-400">{customers.length} total</span>
                </div>

                {customers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4">
                        <EmptyStateIcon className="w-16 h-16 text-gray-300 mb-4" />
                        <p className="text-gray-500 text-sm">No customers yet. Add your first one above.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Full Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm">
                                {customers.map((c, index) => (
                                    <tr key={c.id} className={cn('hover:bg-gray-50', index % 2 !== 0 && 'bg-slate-50/50')}>
                                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{c.full_name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                                            {c.email ? (
                                                <a href={`mailto:${c.email}`} className="hover:text-primary-600 transition-colors">{c.email}</a>
                                            ) : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">{c.phone || '-'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <div className="flex items-center gap-1 justify-end">
                                                <button
                                                    onClick={() => handleEdit(c)}
                                                    className="inline-flex items-center p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                                                    title="Edit Customer"
                                                >
                                                    <PencilIcon className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(c)}
                                                    className="inline-flex items-center p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                                    title="Delete Customer"
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

export default Customers;
