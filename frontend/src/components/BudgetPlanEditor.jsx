import React, { useState, useEffect } from 'react';
import { getBudgetPlans, createBudgetPlan, updateBudgetPlan, deleteBudgetPlan } from '../api';
import { PencilIcon, TrashIcon, CheckIcon, XIcon } from './Icons';
import { cn, formatEURDecimal } from '../lib/utils';

const BudgetPlanEditor = ({ categoryId, categoryName, budgetAmount, onClose }) => {
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState({
        planned_date: '',
        amount: '',
        description: '',
    });
    const [editingId, setEditingId] = useState(null);
    const [message, setMessage] = useState(null);

    useEffect(() => {
        loadPlans();
    }, [categoryId]);

    const loadPlans = async () => {
        try {
            const data = await getBudgetPlans(categoryId);
            setPlans(data);
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to load plans' });
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({ planned_date: '', amount: '', description: '' });
        setEditingId(null);
    };

    const handleSave = async () => {
        if (!formData.planned_date || !formData.amount) {
            setMessage({ type: 'error', text: 'Please fill in date and amount' });
            return;
        }
        const data = {
            planned_date: new Date(formData.planned_date).toISOString(),
            amount: parseFloat(formData.amount),
            description: formData.description || null,
        };
        try {
            if (editingId) {
                await updateBudgetPlan(editingId, data);
                setMessage({ type: 'success', text: 'Updated' });
            } else {
                await createBudgetPlan(categoryId, data);
                setMessage({ type: 'success', text: 'Added' });
            }
            resetForm();
            await loadPlans();
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to save' });
        }
    };

    const handleEdit = (plan) => {
        setFormData({
            planned_date: plan.planned_date.split('T')[0],
            amount: plan.amount.toString(),
            description: plan.description || '',
        });
        setEditingId(plan.id);
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this plan entry?')) return;
        try {
            await deleteBudgetPlan(id);
            await loadPlans();
            setMessage({ type: 'success', text: 'Deleted' });
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to delete' });
        }
    };

    const totalPlanned = plans.reduce((sum, p) => sum + (p.amount || 0), 0);
    const diff = budgetAmount - totalPlanned;

    return (
        <div className="bg-slate-50 p-4 space-y-3 border-t border-primary-200">
            <div className="flex items-center justify-between">
                <h4 className="font-semibold text-gray-800 text-sm">
                    Expense Planning: {categoryName}
                </h4>
                <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-700">
                    Close
                </button>
            </div>

            {message && (
                <div className={cn(
                    'p-2 rounded text-xs font-medium',
                    message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                )}>
                    {message.text}
                </div>
            )}

            {/* Add/Edit Form */}
            <div className="flex items-end gap-2 flex-wrap">
                <div>
                    <label className="label text-xs">Date</label>
                    <input type="date" className="input-field text-sm !py-1"
                        value={formData.planned_date}
                        onChange={e => setFormData({...formData, planned_date: e.target.value})} />
                </div>
                <div>
                    <label className="label text-xs">Amount</label>
                    <input type="number" step="0.01" className="input-field text-sm !py-1 w-32"
                        value={formData.amount}
                        onChange={e => setFormData({...formData, amount: e.target.value})} />
                </div>
                <div className="flex-1 min-w-[150px]">
                    <label className="label text-xs">Description</label>
                    <input type="text" className="input-field text-sm !py-1"
                        value={formData.description}
                        onChange={e => setFormData({...formData, description: e.target.value})} />
                </div>
                <button onClick={handleSave} className="btn-primary text-xs py-1.5 px-3">
                    {editingId ? 'Update' : 'Add'}
                </button>
                {editingId && (
                    <button onClick={resetForm} className="btn-secondary text-xs py-1.5 px-3">Cancel</button>
                )}
            </div>

            {/* Plans List */}
            {plans.length > 0 ? (
                <div className="bg-white rounded border border-gray-200 overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-100 text-xs">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-3 py-1.5 text-left font-medium text-gray-500">Date</th>
                                <th className="px-3 py-1.5 text-right font-medium text-gray-500">Amount</th>
                                <th className="px-3 py-1.5 text-left font-medium text-gray-500">Description</th>
                                <th className="px-3 py-1.5 text-center font-medium text-gray-500">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {plans.map(plan => (
                                <tr key={plan.id} className="hover:bg-gray-50">
                                    <td className="px-3 py-1.5">{new Date(plan.planned_date).toLocaleDateString('en-US')}</td>
                                    <td className="px-3 py-1.5 text-right">{formatEURDecimal(plan.amount)}</td>
                                    <td className="px-3 py-1.5 text-gray-500">{plan.description || '-'}</td>
                                    <td className="px-3 py-1.5">
                                        <div className="flex items-center gap-1 justify-center">
                                            <button onClick={() => handleEdit(plan)}
                                                className="p-0.5 rounded text-gray-400 hover:text-primary-600">
                                                <PencilIcon className="w-3 h-3" />
                                            </button>
                                            <button onClick={() => handleDelete(plan.id)}
                                                className="p-0.5 rounded text-gray-400 hover:text-rose-600">
                                                <TrashIcon className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : !loading && (
                <p className="text-xs text-gray-400 text-center py-2">No plan entries yet</p>
            )}

            {/* Summary */}
            <div className={cn(
                'text-xs font-medium px-2 py-1 rounded',
                Math.abs(diff) < 0.01 ? 'text-emerald-700 bg-emerald-50' :
                diff > 0 ? 'text-amber-700 bg-amber-50' : 'text-rose-700 bg-rose-50'
            )}>
                Total planned: {formatEURDecimal(totalPlanned)} / Budget: {formatEURDecimal(budgetAmount)}
                {Math.abs(diff) >= 0.01 && ` (Difference: ${formatEURDecimal(diff)})`}
            </div>
        </div>
    );
};

export default BudgetPlanEditor;
