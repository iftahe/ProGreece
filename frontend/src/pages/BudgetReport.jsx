import React, { useState, useEffect, useMemo } from 'react';
import { getBudgetReport, getBudgetTimeline, updateBudgetCategory } from '../api';
import { useProject } from '../contexts/ProjectContext';
import { PencilIcon, CheckIcon, XIcon, EmptyStateIcon, CalendarPlanIcon, TimelineIcon, TableIcon } from '../components/Icons';
import BudgetPlanEditor from '../components/BudgetPlanEditor';
import { cn, formatEURDecimal, formatEUR, formatPercent } from '../lib/utils';

const SkeletonBudgetReport = () => (
    <div className="space-y-6">
        <div className="flex justify-between items-center">
            <div className="skeleton h-8 w-40" />
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

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// --- Timeline Bar Component ---
const TimelineBar = ({ category, allMonths, maxBudget }) => {
    if (!allMonths.length || !category.monthly.length) {
        return (
            <div className="flex items-center gap-4 py-3 px-4 border-b border-gray-100 last:border-b-0">
                <div className="w-40 shrink-0">
                    <p className="text-sm font-medium text-gray-700 truncate">{category.name}</p>
                    <p className="text-xs text-gray-400 amount">{formatEUR(category.budget)}</p>
                </div>
                <div className="flex-1 h-10 flex items-center">
                    <span className="text-xs text-gray-400">No planned expenses yet</span>
                </div>
                <div className="w-32 shrink-0" />
            </div>
        );
    }

    const categoryMonthMap = {};
    category.monthly.forEach(m => { categoryMonthMap[m.month] = m; });

    const startIdx = allMonths.indexOf(category.start_month);
    const endIdx = allMonths.indexOf(category.end_month);
    const spanStart = Math.max(0, startIdx);
    const spanEnd = Math.min(allMonths.length - 1, endIdx);

    const isOverBudget = category.progress > 100;
    const isWarning = category.progress > 90 && category.progress <= 100;

    return (
        <div className="flex items-center gap-4 py-3 px-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors">
            {/* Category Label */}
            <div className="w-40 shrink-0">
                <p className="text-sm font-medium text-gray-700 truncate">{category.name}</p>
                <p className="text-xs text-gray-500 amount">{formatEUR(category.budget)}</p>
            </div>

            {/* Timeline Bars */}
            <div className="flex-1 flex items-end gap-px" style={{ height: 40 }}>
                {allMonths.map((month, idx) => {
                    const monthData = categoryMonthMap[month];
                    const isInSpan = idx >= spanStart && idx <= spanEnd;
                    const plannedAmount = monthData?.planned || 0;
                    const actualAmount = monthData?.actual || 0;
                    const maxVal = maxBudget > 0 ? maxBudget : 1;

                    const plannedHeight = maxVal > 0 ? Math.max(plannedAmount > 0 ? 4 : 0, (plannedAmount / maxVal) * 32) : 0;
                    const actualHeight = maxVal > 0 ? Math.max(actualAmount > 0 ? 4 : 0, (actualAmount / maxVal) * 32) : 0;

                    return (
                        <div key={month} className="flex-1 flex items-end justify-center gap-0.5 group relative h-full">
                            {(plannedAmount > 0 || actualAmount > 0) && (
                                <div className="absolute bottom-full mb-1 hidden group-hover:block z-10 pointer-events-none">
                                    <div className="bg-gray-900 text-white text-xs rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg">
                                        <p className="font-medium">{month}</p>
                                        {plannedAmount > 0 && <p>Planned: {formatEUR(plannedAmount)}</p>}
                                        {actualAmount > 0 && <p>Actual: {formatEUR(actualAmount)}</p>}
                                    </div>
                                </div>
                            )}
                            {/* Planned bar */}
                            {isInSpan && (
                                <div
                                    className={cn(
                                        "w-1/2 rounded-t-sm transition-all",
                                        plannedAmount > 0 ? "bg-primary-200" : "bg-gray-100"
                                    )}
                                    style={{ height: plannedAmount > 0 ? plannedHeight : 3 }}
                                />
                            )}
                            {/* Actual bar */}
                            {actualAmount > 0 && (
                                <div
                                    className={cn(
                                        "w-1/2 rounded-t-sm transition-all",
                                        isOverBudget ? "bg-rose-500" : isWarning ? "bg-amber-500" : "bg-primary-600"
                                    )}
                                    style={{ height: actualHeight }}
                                />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Progress & Status */}
            <div className="w-32 shrink-0 text-right">
                <div className="flex items-center gap-2 justify-end">
                    <div className="flex-1 bg-gray-200 rounded-full h-1.5 max-w-[60px]">
                        <div
                            className={cn(
                                "h-1.5 rounded-full transition-all",
                                isOverBudget ? "bg-rose-500" : isWarning ? "bg-amber-500" : "bg-primary-500"
                            )}
                            style={{ width: `${Math.min(category.progress, 100)}%` }}
                        />
                    </div>
                    <span className={cn(
                        "text-xs font-medium w-12 text-right",
                        isOverBudget ? "text-rose-600" : isWarning ? "text-amber-600" : "text-gray-600"
                    )}>
                        {formatPercent(category.progress)}%
                    </span>
                </div>
                {isOverBudget && (
                    <p className="text-xs text-rose-500 font-medium mt-0.5">
                        {formatEUR(Math.abs(category.variance))} over
                    </p>
                )}
            </div>
        </div>
    );
};

const BudgetReport = () => {
    const { selectedProjectId } = useProject();
    const [reportData, setReportData] = useState([]);
    const [timelineData, setTimelineData] = useState([]);
    const [initialLoading, setInitialLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editValue, setEditValue] = useState('');
    const [message, setMessage] = useState(null);
    const [planningCategoryId, setPlanningCategoryId] = useState(null);
    const [viewMode, setViewMode] = useState('table');

    useEffect(() => {
        if (selectedProjectId) {
            loadReportData();
        } else {
            setInitialLoading(false);
        }
    }, [selectedProjectId]);

    const loadReportData = async () => {
        if (!selectedProjectId) return;

        setMessage(null);
        try {
            const [tableData, timeline] = await Promise.all([
                getBudgetReport(selectedProjectId),
                getBudgetTimeline(selectedProjectId).catch(() => []),
            ]);
            setReportData(tableData);
            setTimelineData(timeline);
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

    // Compute timeline global month range and max monthly value
    const { allMonths, maxMonthlyValue } = useMemo(() => {
        const monthSet = new Set();
        let maxVal = 0;
        timelineData.forEach(cat => {
            cat.monthly.forEach(m => {
                monthSet.add(m.month);
                maxVal = Math.max(maxVal, m.planned, m.actual);
            });
        });
        return {
            allMonths: [...monthSet].sort(),
            maxMonthlyValue: maxVal,
        };
    }, [timelineData]);

    // Timeline totals
    const timelineTotals = useMemo(() => {
        const totalBudget = timelineData.reduce((s, c) => s + c.budget, 0);
        const totalActual = timelineData.reduce((s, c) => s + c.total_actual, 0);
        const overBudget = timelineData.filter(c => c.progress > 100).length;
        const warning = timelineData.filter(c => c.progress > 90 && c.progress <= 100).length;
        const onTrack = timelineData.filter(c => c.progress <= 90).length;
        return { totalBudget, totalActual, overBudget, warning, onTrack };
    }, [timelineData]);

    if (initialLoading) return <SkeletonBudgetReport />;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">Budget Report</h2>
                {reportData.length > 0 && (
                    <div className="flex bg-gray-100 rounded-lg p-0.5">
                        <button
                            onClick={() => setViewMode('table')}
                            className={cn("flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                                viewMode === 'table' ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                            )}
                        >
                            <TableIcon className="w-3.5 h-3.5" />
                            Table
                        </button>
                        <button
                            onClick={() => setViewMode('timeline')}
                            className={cn("flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                                viewMode === 'timeline' ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                            )}
                        >
                            <TimelineIcon className="w-3.5 h-3.5" />
                            Timeline
                        </button>
                    </div>
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
                        <p className="text-gray-500 text-sm">No budget data for this project.</p>
                    </div>
                </div>
            )}

            {/* ===== TABLE VIEW ===== */}
            {viewMode === 'table' && reportData.length > 0 && (
                <div className="card overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100">
                        <h3 className="text-lg font-semibold text-gray-900">Budget vs Actual</h3>
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
                                                            <span className={cn(item.is_parent ? 'font-bold' : '', 'amount')}>{formatEURDecimal(item.planned)}</span>
                                                            <button
                                                                onClick={() => handleEditClick(item)}
                                                                className="p-1 rounded text-gray-300 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                                                                title="Edit Budget"
                                                                disabled={saving}
                                                            >
                                                                <PencilIcon className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className={cn('px-6 py-3 whitespace-nowrap text-right amount', item.is_parent && 'font-bold')}>
                                                    {formatEURDecimal(item.actual)}
                                                </td>
                                                <td className={cn(
                                                    'px-6 py-3 whitespace-nowrap text-right font-medium amount',
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
                                                                    item.progress <= 90 ? 'bg-primary-500' :
                                                                    item.progress <= 100 ? 'bg-amber-500' : 'bg-rose-500'
                                                                )}
                                                                style={{ width: `${Math.min(item.progress, 100)}%` }}
                                                            />
                                                        </div>
                                                        <span className={cn(
                                                            'text-xs w-14 text-right font-medium',
                                                            item.progress > 100 ? 'text-rose-600' :
                                                            item.progress > 90 ? 'text-amber-600' : 'text-gray-600'
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
                                                            title="Expense Planning"
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
                                    <td className="px-6 py-3 text-right text-gray-700 amount">{formatEURDecimal(totals.planned)}</td>
                                    <td className="px-6 py-3 text-right text-gray-700 amount">{formatEURDecimal(totals.actual)}</td>
                                    <td className={cn('px-6 py-3 text-right amount', totals.variance >= 0 ? 'text-emerald-700' : 'text-rose-700')}>
                                        {totals.variance >= 0 ? '+' : ''}{formatEURDecimal(totals.variance)}
                                    </td>
                                    <td className="px-6 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 bg-gray-300 rounded-full h-2">
                                                <div
                                                    className={cn(
                                                        'h-2 rounded-full',
                                                        totalProgress <= 90 ? 'bg-primary-600' :
                                                        totalProgress <= 100 ? 'bg-amber-600' : 'bg-rose-600'
                                                    )}
                                                    style={{ width: `${Math.min(totalProgress, 100)}%` }}
                                                />
                                            </div>
                                            <span className={cn(
                                                'text-xs w-14 text-right font-bold',
                                                totalProgress > 100 ? 'text-rose-700' :
                                                totalProgress > 90 ? 'text-amber-700' : 'text-gray-700'
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

            {/* ===== TIMELINE VIEW ===== */}
            {viewMode === 'timeline' && timelineData.length > 0 && (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                        <div className="card-elevated p-4">
                            <p className="text-xs text-gray-500 mb-1">Total Budget</p>
                            <p className="text-lg font-bold text-gray-900 amount">{formatEUR(timelineTotals.totalBudget)}</p>
                        </div>
                        <div className="card-elevated p-4">
                            <p className="text-xs text-gray-500 mb-1">Total Spent</p>
                            <p className="text-lg font-bold text-gray-900 amount">{formatEUR(timelineTotals.totalActual)}</p>
                        </div>
                        <div className="card-elevated p-4">
                            <p className="text-xs text-gray-500 mb-1">On Track</p>
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                                <p className="text-lg font-bold text-gray-900">{timelineTotals.onTrack}</p>
                                {timelineTotals.warning > 0 && (
                                    <>
                                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 ml-2" />
                                        <p className="text-lg font-bold text-amber-600">{timelineTotals.warning}</p>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="card-elevated p-4">
                            <p className="text-xs text-gray-500 mb-1">Over Budget</p>
                            <p className={cn("text-lg font-bold", timelineTotals.overBudget > 0 ? "text-rose-600" : "text-gray-900")}>
                                {timelineTotals.overBudget}
                            </p>
                        </div>
                    </div>

                    {/* Timeline Chart */}
                    <div className="card overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100">
                            <h3 className="text-lg font-semibold text-gray-900">Budget Timeline</h3>
                            <p className="text-xs text-gray-400 mt-1">Planned spending periods with actual spending overlaid</p>
                        </div>

                        {/* Month Headers */}
                        {allMonths.length > 0 && (
                            <div className="flex items-center gap-4 px-4 py-2 bg-slate-50 border-b border-gray-200">
                                <div className="w-40 shrink-0">
                                    <span className="text-xs text-gray-500 font-medium">Category</span>
                                </div>
                                <div className="flex-1 flex gap-px">
                                    {allMonths.map(month => {
                                        const [, m] = month.split('-');
                                        return (
                                            <div key={month} className="flex-1 text-center">
                                                <span className="text-xs text-gray-500 font-medium">
                                                    {MONTH_NAMES[parseInt(m) - 1]}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="w-32 shrink-0 text-right">
                                    <span className="text-xs text-gray-500 font-medium">Progress</span>
                                </div>
                            </div>
                        )}

                        {/* Timeline Rows */}
                        <div>
                            {timelineData.map(category => (
                                <TimelineBar
                                    key={category.id}
                                    category={category}
                                    allMonths={allMonths}
                                    maxBudget={maxMonthlyValue}
                                />
                            ))}
                        </div>

                        {/* Legend */}
                        <div className="px-6 py-3 bg-slate-50 border-t border-gray-200 flex items-center gap-6 flex-wrap">
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 rounded-sm bg-primary-200" />
                                <span className="text-xs text-gray-500">Planned</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 rounded-sm bg-primary-600" />
                                <span className="text-xs text-gray-500">Actual</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 rounded-sm bg-amber-500" />
                                <span className="text-xs text-gray-500">Warning (&gt;90%)</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 rounded-sm bg-rose-500" />
                                <span className="text-xs text-gray-500">Over Budget</span>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Timeline empty state */}
            {viewMode === 'timeline' && timelineData.length === 0 && reportData.length > 0 && (
                <div className="card">
                    <div className="flex flex-col items-center justify-center py-16 px-4">
                        <TimelineIcon className="w-16 h-16 text-gray-300 mb-4" />
                        <p className="text-gray-500 text-sm">Add expense plans to categories to see the timeline view.</p>
                        <p className="text-gray-400 text-xs mt-1">Use the Table view and click the calendar icon to add plans.</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BudgetReport;
