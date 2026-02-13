import React, { useState, useEffect } from 'react';
import { getBudgetReport, updateBudgetCategory, getProjects } from '../api';
import { PencilIcon, CheckIcon, XIcon, EmptyStateIcon, CalendarPlanIcon } from '../components/Icons';
import BudgetPlanEditor from '../components/BudgetPlanEditor';
import { cn, formatEUR, formatEURDecimal, formatPercent } from '../lib/utils';

const SkeletonBudgetReport = () => (
    <div className="space-y-6">
        <div className="flex justify-between items-center">
            <div className="skeleton h-8 w-40" />
            <div className="skeleton h-10 w-48 rounded-lg" />
        </div>
        <div className="card overflow-hidden">
            <div className="px-6 py-4">
                <div className="skeleton h-6 w-32" />
            </div>
            <div className="px-6 space-y-3 pb-6">
                {[...Array(8)].map((_, i) => (
                    <div key={i} className="skeleton h-10 w-full rounded" />
                ))}
            </div>
        </div>
    </div>
);

const BudgetReport = () => {
    const [projects, setProjects] = useState([]);
    const [selectedProjectId, setSelectedProjectId] = useState(null);
    const [reportData, setReportData] = useState([]);
    const [initialLoading, setInitialLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editValue, setEditValue] = useState('');
    const [message, setMessage] = useState(null);
    const [planningCategoryId, setPlanningCategoryId] = useState(null);

    useEffect(() => {
        getProjects().then((projs) => {
            setProjects(projs);
            if (projs.length > 0) {
                setSelectedProjectId(projs[0].id);
            } else {
                setInitialLoading(false);
            }
        });
    }, []);

    useEffect(() => {
        if (selectedProjectId) {
            loadReportData();
        }
    }, [selectedProjectId]);

    const loadReportData = async () => {
        if (!selectedProjectId) return;

        setMessage(null);
        try {
            const data = await getBudgetReport(selectedProjectId);
            setReportData(data);
        } catch (error) {
            console.error("Failed to load budget report", error);
            setMessage({ type: 'error', text: 'Failed to load budget report' });
        } finally {
            setInitialLoading(false);
        }
    };

    const handleEditClick = (item) => {
        setEditingId(item.id);
        setEditValue(item.planned.toString());
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditValue('');
    };

    const handleSaveEdit = async (itemId) => {
        const newAmount = parseFloat(editValue);

        if (isNaN(newAmount) || newAmount < 0) {
            setMessage({ type: 'error', text: 'Please enter a valid positive number' });
            return;
        }

        setSaving(true);
        setMessage(null);

        try {
            await updateBudgetCategory(itemId, newAmount);
            setEditingId(null);
            setEditValue('');
            await loadReportData();
            setMessage({ type: 'success', text: 'Budget amount updated successfully' });
        } catch (error) {
            console.error("Failed to update budget category", error);
            setMessage({ type: 'error', text: 'Failed to update budget amount' });
        } finally {
            setSaving(false);
        }
    };

    const totals = reportData.reduce((acc, item) => {
        if (!item.is_parent) {
            acc.planned += item.planned || 0;
            acc.actual += item.actual || 0;
            acc.variance += item.variance || 0;
        }
        return acc;
    }, { planned: 0, actual: 0, variance: 0 });
    const totalProgress = totals.planned > 0 ? (totals.actual / totals.planned) * 100 : 0;

    if (initialLoading) return <SkeletonBudgetReport />;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">Budget Report</h2>

                {projects.length > 0 && (
                    <select
                        value={selectedProjectId || ''}
                        onChange={(e) => setSelectedProjectId(parseInt(e.target.value))}
                        className="input-field w-auto min-w-[200px]"
                    >
                        {projects.map(project => (
                            <option key={project.id} value={project.id}>
                                {project.name}
                            </option>
                        ))}
                    </select>
                )}
            </div>

            {message && (
                <div className={cn(
                    'p-4 rounded-lg text-sm font-medium',
                    message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                )}>
                    {message.text}
                </div>
            )}

            {!initialLoading && reportData.length === 0 && selectedProjectId && (
                <div className="card">
                    <div className="flex flex-col items-center justify-center py-16 px-4">
                        <EmptyStateIcon className="w-16 h-16 text-gray-300 mb-4" />
                        <p className="text-gray-500 text-sm">No budget data available for this project.</p>
                    </div>
                </div>
            )}

            {reportData.length > 0 && (
                <div className="card overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100">
                        <h3 className="text-lg font-semibold text-gray-900">Budget vs. Actual</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Budget (Planned)</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actual</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Variance</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">Progress</th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm">
                                {reportData.map((item, index) => {
                                    const isChild = !item.is_parent;
                                    const childIndex = isChild ? reportData.slice(0, index).filter(r => !r.is_parent).length : -1;
                                    return (
                                        <React.Fragment key={item.id}>
                                            <tr
                                                className={cn(
                                                    'hover:bg-gray-50',
                                                    item.is_parent && 'bg-slate-100',
                                                    isChild && childIndex % 2 !== 0 && 'bg-slate-50/50'
                                                )}
                                            >
                                                <td className={cn(
                                                    'px-6 py-3 whitespace-nowrap',
                                                    item.is_parent ? 'font-bold text-gray-900' : 'text-gray-700 pl-10'
                                                )}>
                                                    {item.name}
                                                </td>
                                                <td className="px-6 py-3 whitespace-nowrap text-right">
                                                    {editingId === item.id ? (
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                value={editValue}
                                                                onChange={(e) => setEditValue(e.target.value)}
                                                                className="input-field w-32 !mt-0 text-right text-sm !py-1"
                                                                autoFocus
                                                            />
                                                            <button
                                                                onClick={() => handleSaveEdit(item.id)}
                                                                className="p-1 rounded text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 transition-colors"
                                                                title="Save"
                                                                disabled={saving}
                                                            >
                                                                <CheckIcon className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={handleCancelEdit}
                                                                className="p-1 rounded text-rose-600 hover:text-rose-800 hover:bg-rose-50 transition-colors"
                                                                title="Cancel"
                                                                disabled={saving}
                                                            >
                                                                <XIcon className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <span className={item.is_parent ? 'font-bold' : ''}>{formatEURDecimal(item.planned)}</span>
                                                            <button
                                                                onClick={() => handleEditClick(item)}
                                                                className="p-1 rounded text-gray-300 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                                                                title="Edit budget"
                                                                disabled={saving}
                                                            >
                                                                <PencilIcon className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className={cn('px-6 py-3 whitespace-nowrap text-right', item.is_parent && 'font-bold')}>
                                                    {formatEURDecimal(item.actual)}
                                                </td>
                                                <td className={cn(
                                                    'px-6 py-3 whitespace-nowrap text-right font-medium',
                                                    item.variance >= 0 ? 'text-emerald-600' : 'text-rose-600'
                                                )}>
                                                    {item.variance >= 0 ? '+' : ''}{formatEURDecimal(item.variance)}
                                                </td>
                                                <td className="px-6 py-3 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                                                            <div
                                                                className={cn(
                                                                    'h-2 rounded-full transition-all',
                                                                    item.progress <= 100 ? 'bg-primary-500' : 'bg-rose-500'
                                                                )}
                                                                style={{ width: `${Math.min(item.progress, 100)}%` }}
                                                            />
                                                        </div>
                                                        <span className={cn(
                                                            'text-xs w-14 text-right font-medium',
                                                            item.progress > 100 ? 'text-rose-600' : 'text-gray-600'
                                                        )}>
                                                            {formatPercent(item.progress)}%
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-3 text-center">
                                                    {isChild && (
                                                        <button
                                                            onClick={() => setPlanningCategoryId(planningCategoryId === item.id ? null : item.id)}
                                                            className={cn(
                                                                'p-1 rounded transition-colors',
                                                                planningCategoryId === item.id
                                                                    ? 'text-primary-600 bg-primary-50'
                                                                    : 'text-gray-300 hover:text-primary-600 hover:bg-primary-50'
                                                            )}
                                                            title="Plan expenses"
                                                        >
                                                            <CalendarPlanIcon className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                            {/* Inline BudgetPlanEditor */}
                                            {isChild && planningCategoryId === item.id && (
                                                <tr>
                                                    <td colSpan={6}>
                                                        <BudgetPlanEditor
                                                            categoryId={item.id}
                                                            categoryName={item.name}
                                                            budgetAmount={item.planned || 0}
                                                            onClose={() => setPlanningCategoryId(null)}
                                                        />
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}

                                {/* Totals Row */}
                                <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                                    <td className="px-6 py-3 text-gray-700">Total</td>
                                    <td className="px-6 py-3 text-right text-gray-700">{formatEURDecimal(totals.planned)}</td>
                                    <td className="px-6 py-3 text-right text-gray-700">{formatEURDecimal(totals.actual)}</td>
                                    <td className={cn('px-6 py-3 text-right', totals.variance >= 0 ? 'text-emerald-700' : 'text-rose-700')}>
                                        {totals.variance >= 0 ? '+' : ''}{formatEURDecimal(totals.variance)}
                                    </td>
                                    <td className="px-6 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 bg-gray-300 rounded-full h-2">
                                                <div
                                                    className={cn(
                                                        'h-2 rounded-full',
                                                        totalProgress <= 100 ? 'bg-primary-600' : 'bg-rose-600'
                                                    )}
                                                    style={{ width: `${Math.min(totalProgress, 100)}%` }}
                                                />
                                            </div>
                                            <span className={cn(
                                                'text-xs w-14 text-right font-bold',
                                                totalProgress > 100 ? 'text-rose-700' : 'text-gray-700'
                                            )}>
                                                {formatPercent(totalProgress)}%
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-3"></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BudgetReport;
