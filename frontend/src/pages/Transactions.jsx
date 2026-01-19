import React, { useState, useEffect } from 'react';
// הוספנו את getTransactions לייבוא
import { getProjects, getAccounts, createTransaction, getTransactions, deleteTransaction, updateTransaction, getBudgetCategories } from "../api";
// שים לב: בדוק שהנתיב ל-api נכון (אצלך זה אולי '../api' או '../services/api')

const Transactions = () => {
    const [projects, setProjects] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [transactions, setTransactions] = useState([]); // כאן נשמור את הרשימה
    const [budgetCategories, setBudgetCategories] = useState([]); // Budget categories for selected project
    const [editingId, setEditingId] = useState(null); // Track which ID we are editing

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

    // טעינת נתונים ראשונית
    useEffect(() => {
        loadData();
    }, []);

    // טעינת קטגוריות תקציב כאשר פרויקט משתנה
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
            // Reset budget_item_id when project changes
            setFormData(prev => ({ ...prev, budget_item_id: '' }));
        };

        loadBudgetCategories();
    }, [formData.project_id]);

    const loadData = async () => {
        try {
            const [projs, accs, txs] = await Promise.all([
                getProjects(),
                getAccounts(),
                getTransactions() // טעינת התנועות
            ]);

            setProjects(projs);
            setAccounts(accs);
            setTransactions(txs); // שמירת התנועות בסטייט

            if (projs.length > 0 && !editingId) {
                setFormData(prev => ({ ...prev, project_id: projs[0].id }));
            }
        } catch (error) {
            console.error("Failed to load data", error);
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
            // Note: Backend expects 'remarks' not 'description', and 'transaction_type' not 'status'
            const payload = {
                date: formData.date,
                amount: parseFloat(formData.amount),
                vat_rate: parseFloat(formData.vat_rate),
                project_id: formData.project_id ? parseInt(formData.project_id) : null,
                budget_item_id: formData.budget_item_id ? parseInt(formData.budget_item_id) : null,
                from_account_id: formData.from_account_id ? parseInt(formData.from_account_id) : null,
                to_account_id: formData.to_account_id ? parseInt(formData.to_account_id) : null,
                remarks: formData.description,
                transaction_type: formData.status === 'Executed' ? 1 : 2 // 1=Executed, 2=Planned
            };

            if (editingId) {
                // UPDATE MODE
                await updateTransaction(editingId, payload);
                setMessage({ type: 'success', text: 'Transaction updated successfully!' });
            } else {
                // CREATE MODE
                await createTransaction(payload);
                setMessage({ type: 'success', text: 'Transaction created successfully!' });
            }

            resetForm();
            loadData(); // Refresh list

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
                loadData(); // Refresh list
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
            description: transaction.remarks || '', // Map remarks to description
            project_id: transaction.project_id || '',
            budget_item_id: transaction.budget_item_id || '',
            from_account_id: transaction.from_account_id || '',
            to_account_id: transaction.to_account_id || '',
            vat_rate: transaction.vat_rate || 0,
            status: transaction.transaction_type === 1 ? 'Executed' : 'Planned' // Heuristic mapping, logic might differ
        });
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const resetForm = () => {
        setEditingId(null);
        setFormData(initialFormState);
        // Reset project default if available
        if (projects.length > 0) {
            setFormData(prev => ({ ...prev, project_id: projects[0].id }));
        }
    };

    // פונקציית עזר למציאת שם חשבון לפי ID
    const getAccountName = (id) => {
        const acc = accounts.find(a => a.id === id);
        return acc ? acc.name : '-';
    };

    // פונקציית עזר למציאת שם פרויקט
    const getProjectName = (id) => {
        const proj = projects.find(p => p.id === id);
        return proj ? proj.name : '-';
    };

    // פונקציית עזר למציאת שם קטגוריית תקציב
    const getBudgetCategoryName = (id) => {
        if (!id) return '-';
        const category = budgetCategories.find(c => c.id === id);
        if (!category) return '-';
        
        // If category has a parent, show "Phase > Category" format
        if (category.parent_id) {
            const parent = budgetCategories.find(c => c.id === category.parent_id);
            return parent ? `${parent.name} > ${category.name}` : category.name;
        }
        // If it's a phase (parent), just show the name
        return category.name;
    };

    // פונקציית עזר למיפוי קטגוריות לתצוגה ב-dropdown
    const getCategoryDisplayName = (category) => {
        // If category has a parent, show "Phase > Category" format
        if (category.parent_id) {
            const parent = budgetCategories.find(c => c.id === category.parent_id);
            return parent ? `${parent.name} > ${category.name}` : category.name;
        }
        // If it's a phase (parent), just show the name
        return category.name;
    };

    return (
        <div className="max-w-6xl mx-auto bg-white p-8 rounded-lg shadow space-y-12">

            {/* --- FORM SECTION --- */}
            <div>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">
                        {editingId ? 'Edit Transaction' : 'New Transaction'}
                    </h2>
                    {editingId && (
                        <button onClick={resetForm} className="text-sm text-red-600 hover:text-red-800 underline">
                            Cancel Edit
                        </button>
                    )}
                </div>

                {message && (
                    <div className={`p-4 mb-4 rounded ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6 border-b pb-8">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Date</label>
                            <input type="date" name="date" value={formData.date} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm border p-2" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Amount</label>
                            <input type="number" step="0.01" name="amount" value={formData.amount} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm border p-2" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Description</label>
                            <input type="text" name="description" value={formData.description} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm border p-2" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Project</label>
                            <select name="project_id" value={formData.project_id} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm border p-2">
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
                                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm border p-2"
                                disabled={!formData.project_id || budgetCategories.length === 0}
                            >
                                <option value="">{formData.project_id && budgetCategories.length === 0 ? 'Loading...' : 'Select Category (Optional)'}</option>
                                {budgetCategories
                                    .filter(cat => cat.parent_id !== null) // Only show child categories (not phase parents)
                                    .map(cat => (
                                        <option key={cat.id} value={cat.id}>
                                            {getCategoryDisplayName(cat)}
                                        </option>
                                    ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">From Account</label>
                            <select name="from_account_id" value={formData.from_account_id} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm border p-2">
                                <option value="">None</option>
                                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">To Account</label>
                            <select name="to_account_id" value={formData.to_account_id} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm border p-2">
                                <option value="">None</option>
                                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Status</label>
                            <select name="status" value={formData.status} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm border p-2">
                                <option value="Planned">Planned</option>
                                <option value="Executed">Executed</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex justify-end gap-3">
                        {editingId && (
                            <button type="button" onClick={resetForm} className="py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                                Cancel
                            </button>
                        )}
                        <button type="submit" disabled={loading} className={`inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${editingId ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                            {loading ? 'Saving...' : (editingId ? 'Update Transaction' : 'Save Transaction')}
                        </button>
                    </div>
                </form>
            </div>

            {/* --- TABLE SECTION (החלק החדש) --- */}
            <div>
                <h3 className="text-xl font-bold mb-4 text-gray-800">Transaction History</h3>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Budget Category</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">From</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">To</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {transactions.length === 0 ? (
                                <tr>
                                    <td colSpan="9" className="px-6 py-4 text-center text-gray-500">No transactions found.</td>
                                </tr>
                            ) : (
                                transactions.map((t) => (
                                    <tr key={t.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {new Date(t.date).toLocaleDateString('en-GB')}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {getProjectName(t.project_id)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {getBudgetCategoryName(t.budget_item_id)}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {t.remarks || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {getAccountName(t.from_account_id)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {getAccountName(t.to_account_id)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                            {Number(t.amount).toLocaleString()} ₪
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${t.status === 'Executed' || t.transaction_type === 1 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                {/* Use transaction_type=1 (general/income) as executed for now if status missing */}
                                                {t.transaction_type === 1 ? 'Executed' : 'Planned'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button onClick={() => handleEdit(t)} className="text-indigo-600 hover:text-indigo-900 mr-4">
                                                Edit
                                            </button>
                                            <button onClick={() => handleDelete(t.id)} className="text-red-600 hover:text-red-900">
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
};

export default Transactions;