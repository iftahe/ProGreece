import React, { useState, useEffect } from 'react';
import { getBudgetPlans, createBudgetPlan, updateBudgetPlan, deleteBudgetPlan } from '../api';
import { PencilIcon, TrashIcon, CheckIcon, XIcon } from './Icons';
import ConfirmDialog from './ConfirmDialog';
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
    const [confirmDialog, setConfirmDialog] = useState({ open: false, id: null });

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
                setMessage({ type: 'success', text: 'Updated successfully' });
            } else {
                await createBudgetPlan(categoryId, data);
                setMessage({ type: 'success', text: 'Added successfully' });
            }
            resetForm();
            await loadPlans();
        } catch (error) {
            setMessage({ type: 'error', text: 'Save failed' });
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

    const handleDeleteClick = (id) => {
        setConfirmDialog({ open: true, id });
    };

    const handleDeleteConfirm = async () => {
        const id = confirmDialog.id;
        setConfirmDialog({ open: false, id: null });
        try {
            await deleteBudgetPlan(id);
            await loadPlans();
            setMessage({ type: 'success', text: 'Deleted successfully' });
        } catch (error) {
            setMessage({ type: 'error', text: 'Delete failed' });
        }
    };

    const totalPlanned = plans.reduce((sum, p) => sum + (p.amount || 0), 0);
    const diff = budgetAmount - totalPlanned;

    return (
        <div className="bg-slate-50 p-4 space-y-3 border-t border-primary-200">
            <div className="flex items-center justify-between">
                <h4 className="font-semibold text-gray-800 text-sm">
                    {'Expense Planning:'} {categoryName}
                </h4>
                <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700">
                    {'Close'}
                </button>
            </div>

            {message && (
                <div className={cn(
                    'p-2 rounded text-sm font-medium',
                    message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                )}>
                    {message.text}
                </div>
            )}

            {/* Add/Edit Form */}
            <div className="flex items-end gap-2 flex-wrap">
                <div>
                    <label className="label">{'Date'}</label>
                    <input type="date" className="input-field !py-1.5"
                        value={formData.planned_date}
                        onChange={e => setFormData({...formData, planned_date: e.target.value})} />
                </div>
                <div>
                    <label className="label">{'Amount'}</label>
                    <input type="number" step="0.01" className="input-field !py-1.5 w-32"
                        value={formData.amount}
                        onChange={e => setFormData({...formData, amount: e.target.value})} />
                </div>
                <div className="flex-1 min-w-[150px]">
                    <label className="label">{'Description'}</label>
                    <input type="text" className="input-field !py-1.5"
                        value={formData.description}
                        onChange={e => setFormData({...formData, description: e.target.value})} />
                </div>
                <button onClick={handleSave} className="btn-primary text-sm py-1.5 px-3">
                    {editingId ? 'Update' : 'Add'}
                </button>
                {editingId && (
                    <button onClick={resetForm} className="btn-secondary text-sm py-1.5 px-3">{'Cancel'}</button>
                )}
            </div>

            {/* Plans List */}
            {plans.length > 0 ? (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-100 text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-2 text-left font-medium text-gray-500">{'Date'}</th>
                                <th className="px-4 py-2 text-right font-medium text-gray-500">{'Amount'}</th>
                                <th className="px-4 py-2 text-left font-medium text-gray-500">{'Description'}</th>
                                <th className="px-4 py-2 text-center font-medium text-gray-500">{'Actions'}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {plans.map(plan => (
                                <tr key={plan.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-2">{new Date(plan.planned_date).toLocaleDateString('en-GB')}</td>
                                    <td className="px-4 py-2 text-right amount">{formatEURDecimal(plan.amount)}</td>
                                    <td className="px-4 py-2 text-gray-500">{plan.description || '-'}</td>
                                    <td className="px-4 py-2">
                                        <div className="flex items-center gap-1.5 justify-center">
                                            <button onClick={() => handleEdit(plan)}
                                                className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors">
                                                <PencilIcon className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleDeleteClick(plan.id)}
                                                className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors">
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : !loading && (
                <p className="text-sm text-gray-400 text-center py-2">{'No plan records yet'}</p>
            )}

            {/* Summary */}
            <div className={cn(
                'text-sm font-medium px-3 py-2 rounded-lg',
                Math.abs(diff) < 0.01 ? 'text-emerald-700 bg-emerald-50' :
                diff > 0 ? 'text-amber-700 bg-amber-50' : 'text-rose-700 bg-rose-50'
            )}>
                {'Total Planned:'} {formatEURDecimal(totalPlanned)} / {'Budget:'} {formatEURDecimal(budgetAmount)}
                {Math.abs(diff) >= 0.01 && ` (Difference: ${formatEURDecimal(diff)})`}
            </div>

            <ConfirmDialog
                open={confirmDialog.open}
                title={'Delete Record'}
                message={'Delete this plan record?'}
                onConfirm={handleDeleteConfirm}
                onCancel={() => setConfirmDialog({ open: false, id: null })}
            />
        </div>
    );
};

export default BudgetPlanEditor;
