import React, { useState, useEffect } from 'react';
import {
    getInvoices, createInvoice, updateInvoice, deleteInvoice,
    getProjects, getCustomers, getCounterparties
} from '../api';
import { PencilIcon, TrashIcon, EmptyStateIcon } from '../components/Icons';
import { cn, formatEUR } from '../lib/utils';

const SkeletonInvoices = () => (
    <div className="space-y-6">
        <div className="flex justify-between items-center">
            <div className="skeleton h-8 w-32" />
            <div className="skeleton h-9 w-32 rounded-lg" />
        </div>
        <div className="card overflow-hidden">
            <div className="px-6 py-4">
                <div className="skeleton h-6 w-28" />
            </div>
            <div className="px-6 space-y-3 pb-6">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="skeleton h-12 w-full rounded" />
                ))}
            </div>
        </div>
    </div>
);

const CURRENCIES = ['EUR', 'USD', 'ILS', 'GBP'];

export default function Invoices() {
    const [invoices, setInvoices] = useState([]);
    const [projects, setProjects] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [counterparties, setCounterparties] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [formData, setFormData] = useState({
        project_id: '',
        customer_id: '',
        counterparty_id: '',
        invoice_number: '',
        invoice_date: '',
        invoice_value: '',
        currency: 'EUR',
        remarks: ''
    });

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [inv, proj, cust, cp] = await Promise.all([
                getInvoices(), getProjects(), getCustomers(), getCounterparties()
            ]);
            setInvoices(inv);
            setProjects(proj);
            setCustomers(cust);
            setCounterparties(cp);
        } catch (e) {
            console.error(e);
            setError('Failed to load invoices');
        }
        setLoading(false);
    };

    useEffect(() => { fetchAll(); }, []);

    const openCreate = () => {
        setEditing(null);
        setError(null);
        setFormData({
            project_id: '',
            customer_id: '',
            counterparty_id: '',
            invoice_number: '',
            invoice_date: new Date().toISOString().split('T')[0],
            invoice_value: '',
            currency: 'EUR',
            remarks: ''
        });
        setShowModal(true);
    };

    const openEdit = (inv) => {
        setEditing(inv);
        setError(null);
        setFormData({
            project_id: inv.project_id || '',
            customer_id: inv.customer_id || '',
            counterparty_id: inv.counterparty_id || '',
            invoice_number: inv.invoice_number || '',
            invoice_date: inv.invoice_date || '',
            invoice_value: inv.invoice_value || '',
            currency: inv.currency || 'EUR',
            remarks: inv.remarks || ''
        });
        setShowModal(true);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        try {
            const payload = {
                ...formData,
                project_id: parseInt(formData.project_id),
                customer_id: formData.customer_id ? parseInt(formData.customer_id) : null,
                counterparty_id: formData.counterparty_id ? parseInt(formData.counterparty_id) : null,
                invoice_value: parseFloat(formData.invoice_value)
            };
            if (editing) {
                await updateInvoice(editing.id, payload);
            } else {
                await createInvoice(payload);
            }
            setShowModal(false);
            fetchAll();
        } catch (e) {
            console.error(e);
            setError(e?.response?.data?.detail || 'Failed to save invoice');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this invoice? This cannot be undone.')) return;
        try {
            await deleteInvoice(id);
            fetchAll();
        } catch (e) {
            console.error(e);
            setError('Failed to delete invoice');
        }
    };

    const getProjectName = (id) => projects.find(p => p.id === id)?.name || '-';
    const getCustomerName = (id) => id ? (customers.find(c => c.id === id)?.full_name || '-') : '-';
    const getCPName = (id) => id ? (counterparties.find(c => c.id === id)?.name || '-') : '-';

    if (loading) return <SkeletonInvoices />;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
                <button
                    onClick={openCreate}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
                >
                    <span className="text-lg leading-none">+</span>
                    Add Invoice
                </button>
            </div>

            {error && !showModal && (
                <div className="p-4 rounded-lg text-sm font-medium bg-rose-50 text-rose-700 border border-rose-200">
                    {error}
                </div>
            )}

            {/* Table */}
            <div className="card overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900">All Invoices</h3>
                </div>

                {invoices.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4">
                        <EmptyStateIcon className="w-16 h-16 text-gray-300 mb-4" />
                        <p className="text-gray-500 text-sm">No invoices yet. Add your first invoice above.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice #</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Counterparty</th>
                                    <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                                    <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                                    <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm">
                                {invoices.map((inv, index) => {
                                    const balance = inv.balance ?? inv.invoice_value;
                                    const isPaid = balance !== null && balance <= 0;
                                    const isPartial = balance !== null && balance > 0 && balance < inv.invoice_value;
                                    return (
                                        <tr key={inv.id} className={cn('hover:bg-gray-50', index % 2 !== 0 && 'bg-slate-50/50')}>
                                            <td className="px-5 py-4 whitespace-nowrap font-medium text-gray-900">
                                                {inv.invoice_number || '-'}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-gray-600">
                                                {inv.invoice_date || '-'}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-gray-700">
                                                {getProjectName(inv.project_id)}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-gray-700">
                                                {getCustomerName(inv.customer_id)}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-gray-700">
                                                {getCPName(inv.counterparty_id)}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-right font-medium text-gray-900">
                                                {formatEUR(inv.invoice_value)}
                                                {inv.currency && inv.currency !== 'EUR' && (
                                                    <span className="ml-1 text-xs text-gray-400">{inv.currency}</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-right">
                                                {balance !== null && balance !== undefined ? (
                                                    <span className={cn(
                                                        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                                                        isPaid
                                                            ? 'bg-emerald-50 text-emerald-700'
                                                            : isPartial
                                                                ? 'bg-amber-50 text-amber-700'
                                                                : 'bg-rose-50 text-rose-700'
                                                    )}>
                                                        {isPaid ? 'Paid' : formatEUR(balance)}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400">-</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-right">
                                                <div className="inline-flex items-center gap-1">
                                                    <button
                                                        onClick={() => openEdit(inv)}
                                                        className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                                                        title="Edit Invoice"
                                                    >
                                                        <PencilIcon className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(inv.id)}
                                                        className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                                        title="Delete Invoice"
                                                    >
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="fixed inset-0 bg-black/40" onClick={() => setShowModal(false)} />
                    <div className="flex min-h-full items-center justify-center p-4">
                        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg">
                            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                                <h2 className="text-lg font-semibold text-gray-900">
                                    {editing ? 'Edit Invoice' : 'Add Invoice'}
                                </h2>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                                >
                                    <span className="text-xl leading-none">&times;</span>
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
                                {error && (
                                    <div className="p-3 rounded-lg text-sm font-medium bg-rose-50 text-rose-700 border border-rose-200">
                                        {error}
                                    </div>
                                )}

                                {/* Row 1: Project (required) */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Project <span className="text-rose-500">*</span>
                                    </label>
                                    <select
                                        name="project_id"
                                        value={formData.project_id}
                                        onChange={handleChange}
                                        required
                                        className="input-field"
                                    >
                                        <option value="">Select project...</option>
                                        {projects.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Row 2: Customer + Counterparty */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
                                        <select
                                            name="customer_id"
                                            value={formData.customer_id}
                                            onChange={handleChange}
                                            className="input-field"
                                        >
                                            <option value="">None</option>
                                            {customers.map(c => (
                                                <option key={c.id} value={c.id}>{c.full_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Counterparty</label>
                                        <select
                                            name="counterparty_id"
                                            value={formData.counterparty_id}
                                            onChange={handleChange}
                                            className="input-field"
                                        >
                                            <option value="">None</option>
                                            {counterparties.map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Row 3: Invoice # + Date */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Number</label>
                                        <input
                                            type="text"
                                            name="invoice_number"
                                            value={formData.invoice_number}
                                            onChange={handleChange}
                                            placeholder="e.g. INV-001"
                                            className="input-field"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Date <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="date"
                                            name="invoice_date"
                                            value={formData.invoice_date}
                                            onChange={handleChange}
                                            required
                                            className="input-field"
                                        />
                                    </div>
                                </div>

                                {/* Row 4: Value + Currency */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Value <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            name="invoice_value"
                                            value={formData.invoice_value}
                                            onChange={handleChange}
                                            required
                                            placeholder="0.00"
                                            className="input-field"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                                        <select
                                            name="currency"
                                            value={formData.currency}
                                            onChange={handleChange}
                                            className="input-field"
                                        >
                                            {CURRENCIES.map(c => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Row 5: Remarks */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
                                    <textarea
                                        name="remarks"
                                        value={formData.remarks}
                                        onChange={handleChange}
                                        rows={2}
                                        placeholder="Optional notes..."
                                        className="input-field resize-none"
                                    />
                                </div>

                                <div className="flex justify-end gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className={cn(
                                            'px-5 py-2 text-sm font-semibold text-white rounded-lg shadow-sm transition-colors',
                                            editing
                                                ? 'bg-amber-600 hover:bg-amber-700'
                                                : 'bg-primary-600 hover:bg-primary-700',
                                            saving && 'opacity-50 cursor-not-allowed'
                                        )}
                                    >
                                        {saving ? 'Saving...' : (editing ? 'Update Invoice' : 'Create Invoice')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
