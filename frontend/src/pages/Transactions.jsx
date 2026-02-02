import React, { useState, useEffect } from 'react';
import { getProjects, getAccounts, createTransaction, getTransactions, deleteTransaction, updateTransaction, getBudgetCategories } from "../api";
import { PencilIcon, TrashIcon, EmptyStateIcon } from '../components/Icons';
import { cn, formatEUR } from '../lib/utils';

const Transactions = () => {
    const [projects, setProjects] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [budgetCategories, setBudgetCategories] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [initialLoading, setInitialLoading] = useState(true);

    const initialFormState = {
        date: new Date().toISOString().split('T')[0],
        amount: '',
        description: '',
        project_id: '',
        budget_item_id: '',
        from_account_id: '',
        to_account_id: '',
        vat_rate: '0',
        status: 'Executed'
    };

    const [formData, setFormData] = useState(initialFormState);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    useEffect(() => { loadData(); }, []);

    useEffect(() => {
        const loadBudgetCategories = async () => {
            if (formData.project_id) {
                try {
                    const categories = await getBudgetCategories(formData.project_id);
                    setBudgetCategories(categories);
                } catch (error) {
                    console.error("Failed to load budget categories", error);
                    setBudgetCategories([]);
                }
            } else {
                setBudgetCategories([]);
            }
            setFormData(prev => ({ ...prev, budget_item_id: '' }));
        };
        loadBudgetCategories();
    }, [formData.project_id]);

    const loadData = async () => {
        try {
            const [projs, accs, txs] = await Promise.all([
                getProjects(), getAccounts(), getTransactions()
            ]);
            setProjects(projs);
            setAccounts(accs);
            setTransactions(txs);
            if (projs.length > 0 && !editingId) {
                setFormData(prev => ({ ...prev, project_id: projs[0].id }));
            }
        } catch (error) {
            console.error("Failed to load data", error);
        } finally {
            setInitialLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);
        try {
            const payload = {
                date: formData.date,
                amount: parseFloat(formData.amount),
                vat_rate: parseFloat(formData.vat_rate),
                project_id: formData.project_id ? parseInt(formData.project_id) : null,
                budget_item_id: formData.budget_item_id ? parseInt(formData.budget_item_id) : null,
                from_account_id: formData.from_account_id ? parseInt(formData.from_account_id) : null,
                to_account_id: formData.to_account_id ? parseInt(formData.to_account_id) : null,
                remarks: formData.description,
                transaction_type: formData.status === 'Executed' ? 1 : 2
            };
            if (editingId) {
                await updateTransaction(editingId, payload);
                setMessage({ type: 'success', text: 'Transaction updated successfully!' });
            } else {
                await createTransaction(payload);
                setMessage({ type: 'success', text: 'Transaction created successfully!' });
            }
            resetForm();
            loadData();
        } catch (error) {
            console.error(error);
            setMessage({ type: 'error', text: 'Failed to save transaction.' });
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to delete this transaction? This cannot be undone.")) {
            try {
                await deleteTransaction(id);
                loadData();
                setMessage({ type: 'success', text: 'Transaction deleted.' });
            } catch (error) {
                console.error(error);
                setMessage({ type: 'error', text: 'Failed to delete transaction.' });
            }
        }
    };

    const handleEdit = (transaction) => {
        setEditingId(transaction.id);
        setFormData({
            date: transaction.date ? transaction.date.split('T')[0] : '',
            amount: transaction.amount,
            description: transaction.remarks || transaction.description || '',
            project_id: transaction.project_id || '',
            budget_item_id: transaction.budget_item_id || '',
            from_account_id: transaction.from_account_id || '',
            to_account_id: transaction.to_account_id || '',
            vat_rate: transaction.vat_rate || 0,
            status: transaction.transaction_type === 1 ? 'Executed' : 'Planned'
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const resetForm = () => {
        setEditingId(null);
        setFormData(initialFormState);
        if (projects.length > 0) {
            setFormData(prev => ({ ...prev, project_id: projects[0].id }));
        }
    };

    const cleanField = (val) => {
        if (!val || val === 'nan' || val === 'None' || val === 'null') return null;
        const trimmed = String(val).trim();
        return trimmed || null;
    };

    const getAccountName = (id, fallbackText) => {
        if (id) {
            const acc = accounts.find(a => a.id === id);
            if (acc) return acc.name;
        }
        return cleanField(fallbackText) || '-';
    };

    const getProjectName = (id) => {
        const proj = projects.find(p => p.id === id);
        return proj ? proj.name : '-';
    };

    const getBudgetCategoryName = (id) => {
        if (!id) return null;
        const category = budgetCategories.find(c => c.id === id);
        if (!category) return null;
        return category.category_name || category.name || null;
    };

    const getCategoryDisplayName = (category) => {
        return category.category_name || category.name || '-';
    };

    const getTransactionDescription = (t) => {
        return cleanField(t.remarks) || cleanField(t.description) || '-';
    };

    const getTransactionCategory = (t) => {
        const budgetName = getBudgetCategoryName(t.budget_item_id);
        if (budgetName) return budgetName;
        const cat = cleanField(t.category);
        if (cat) return cat;
        return '-';
    };

    const isIncome = (t) => {
        return t.type === 'income';
    };

    return (
        <div className="space-y-8">
            {/* Form Card */}
            <div className="card p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">
                        {editingId ? 'Edit Transaction' : 'New Transaction'}
                    </h2>
                    {editingId && (
                        <button onClick={resetForm} className="text-sm text-expense hover:text-rose-700 font-medium">
                            Cancel Edit
                        </button>
                    )}
                </div>

                {message && (
                    <div className={cn("p-4 mb-4 rounded-lg text-sm font-medium", message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700')}>
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Basic Details */}
                    <fieldset className="space-y-3">
                        <legend className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Basic Details</legend>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Date</label>
                                <input type="date" name="date" value={formData.date} onChange={handleChange} required className="input-field" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Amount</label>
                                <input type="number" step="0.01" name="amount" value={formData.amount} onChange={handleChange} required className="input-field" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700">Description</label>
                                <input type="text" name="description" value={formData.description} onChange={handleChange} className="input-field" />
                            </div>
                        </div>
                    </fieldset>

                    {/* Categorization */}
                    <fieldset className="space-y-3">
                        <legend className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Categorization</legend>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Project</label>
                                <select name="project_id" value={formData.project_id} onChange={handleChange} className="input-field">
                                    <option value="">Select Project</option>
                                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Budget Category</label>
                                <select
                                    name="budget_item_id"
                                    value={formData.budget_item_id}
                                    onChange={handleChange}
                                    className="input-field"
                                    disabled={!formData.project_id || budgetCategories.length === 0}
                                >
                                    <option value="">{formData.project_id && budgetCategories.length === 0 ? 'Loading...' : 'Select Category (Optional)'}</option>
                                    {budgetCategories.map(cat => (
                                        <option key={cat.id} value={cat.id}>{getCategoryDisplayName(cat)}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </fieldset>

                    {/* Accounts & Status */}
                    <fieldset className="space-y-3">
                        <legend className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Accounts & Status</legend>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">From Account</label>
                                <select name="from_account_id" value={formData.from_account_id} onChange={handleChange} className="input-field">
                                    <option value="">None</option>
                                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">To Account</label>
                                <select name="to_account_id" value={formData.to_account_id} onChange={handleChange} className="input-field">
                                    <option value="">None</option>
                                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Status</label>
                                <select name="status" value={formData.status} onChange={handleChange} className="input-field">
                                    <option value="Planned">Planned</option>
                                    <option value="Executed">Executed</option>
                                </select>
                            </div>
                        </div>
                    </fieldset>

                    <div className="flex justify-end gap-3 pt-2">
                        {editingId && (
                            <button type="button" onClick={resetForm} className="py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors">
                                Cancel
                            </button>
                        )}
                        <button type="submit" disabled={loading} className={cn(
                            "py-2 px-6 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white transition-colors",
                            editingId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-primary-600 hover:bg-primary-700'
                        )}>
                            {loading ? 'Saving...' : (editingId ? 'Update Transaction' : 'Save Transaction')}
                        </button>
                    </div>
                </form>
            </div>

            {/* Table Card */}
            <div className="card overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900">Transaction History</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">From</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">To</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                            {initialLoading ? (
                                [...Array(5)].map((_, i) => (
                                    <tr key={i}>
                                        {[...Array(10)].map((_, j) => (
                                            <td key={j} className="px-4 py-4"><div className="skeleton h-4 w-full" /></td>
                                        ))}
                                    </tr>
                                ))
                            ) : transactions.length === 0 ? (
                                <tr>
                                    <td colSpan="10" className="px-6 py-16 text-center">
                                        <div className="flex flex-col items-center">
                                            <EmptyStateIcon className="w-16 h-16 text-gray-300 mb-4" />
                                            <p className="text-gray-500 font-medium mb-1">No transactions yet</p>
                                            <p className="text-sm text-gray-400">Get started by creating your first transaction above.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                <>
                                    {transactions.map((t, index) => (
                                        <tr key={t.id} className={cn(
                                            "hover:bg-gray-50",
                                            index % 2 !== 0 && "bg-slate-50/50",
                                            isIncome(t) && "border-l-4 border-l-emerald-400"
                                        )}>
                                            <td className="px-4 py-3 whitespace-nowrap text-gray-900">
                                                {new Date(t.date).toLocaleDateString('en-GB')}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-gray-500">{getProjectName(t.project_id)}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-gray-500">{getTransactionCategory(t)}</td>
                                            <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate">{getTransactionDescription(t)}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-gray-500">{getAccountName(t.from_account_id)}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-gray-500">{getAccountName(t.to_account_id, t.supplier)}</td>
                                            <td className={cn(
                                                "px-4 py-3 whitespace-nowrap text-right font-semibold",
                                                isIncome(t) ? "text-emerald-600" : "text-rose-600"
                                            )}>
                                                {isIncome(t) ? '+' : '-'}{formatEUR(t.amount)}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <span className={cn(
                                                    "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full",
                                                    isIncome(t)
                                                        ? "bg-emerald-50 text-emerald-700"
                                                        : "bg-rose-50 text-rose-700"
                                                )}>
                                                    <span className={cn(
                                                        "w-1.5 h-1.5 rounded-full",
                                                        isIncome(t) ? "bg-emerald-500" : "bg-rose-500"
                                                    )} />
                                                    {isIncome(t) ? 'Income' : 'Expense'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <span className={cn(
                                                    "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full",
                                                    t.transaction_type === 1
                                                        ? "bg-sky-50 text-sky-700"
                                                        : "bg-amber-50 text-amber-700"
                                                )}>
                                                    <span className={cn(
                                                        "w-1.5 h-1.5 rounded-full",
                                                        t.transaction_type === 1 ? "bg-sky-500" : "bg-amber-500"
                                                    )} />
                                                    {t.transaction_type === 1 ? 'Executed' : 'Planned'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button onClick={() => handleEdit(t)} className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors" title="Edit">
                                                        <PencilIcon className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => handleDelete(t.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-expense hover:bg-rose-50 transition-colors" title="Delete">
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                                        <td colSpan="6" className="px-4 py-3 text-right text-sm text-gray-700">Total</td>
                                        <td className="px-4 py-3 text-right text-sm text-gray-900">
                                            {formatEUR(transactions.reduce((sum, t) => sum + Number(t.amount), 0))}
                                        </td>
                                        <td colSpan="3" />
                                    </tr>
                                </>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Transactions;
