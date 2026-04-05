import React, { useState, useEffect, useMemo } from 'react';
import { getBudgetReport, getBudgetTimeline, updateBudgetCategory, getTransactions, runBudgetMapper, bulkAssignBudget, getBudgetCategories } from '../api';
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

// --- Budget Mapper Panel ---
const BudgetMapperPanel = ({ projectId, onMappingApplied }) => {
    const [expanded, setExpanded] = useState(false);
    const [loading, setLoading] = useState(false);
    const [applying, setApplying] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [scanMessage, setScanMessage] = useState(null);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [categories, setCategories] = useState([]);
    const [assignCategoryId, setAssignCategoryId] = useState('');
    const [assigning, setAssigning] = useState(false);
    const [directionOverrides, setDirectionOverrides] = useState({});

    const handlePreview = async () => {
        setLoading(true);
        setError(null);
        setResult(null);
        setScanMessage(null);
        try {
            const data = await runBudgetMapper(projectId, { dryRun: true });
            setResult(data);
            setScanMessage('Scan complete');
            setTimeout(() => setScanMessage(null), 3000);
        } catch (err) {
            console.error('Budget mapper error:', err);
            setError(`Failed to scan transactions: ${err.response?.data?.detail || err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleApply = async () => {
        setApplying(true);
        setError(null);
        try {
            const data = await runBudgetMapper(projectId, { dryRun: false });
            setResult(data);
            if (data.updated > 0) {
                onMappingApplied();
            }
        } catch (err) {
            setError('Failed to apply mappings');
        } finally {
            setApplying(false);
        }
    };

    useEffect(() => {
        if (projectId) {
            getBudgetCategories(projectId).then(setCategories).catch(() => {});
        }
    }, [projectId]);

    const toggleSelect = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (!result?.unmatched) return;
        const allIds = result.unmatched.map(u => u.transaction_id);
        setSelectedIds(prev => prev.size === allIds.length ? new Set() : new Set(allIds));
    };

    const handleBulkAssign = async () => {
        if (!assignCategoryId || selectedIds.size === 0) return;
        setAssigning(true);
        setError(null);
        try {
            // Group selected transaction IDs by their direction override
            const groups = {};
            for (const id of selectedIds) {
                const txDirection = directionOverrides[id] || (result?.unmatched?.find(u => u.transaction_id === id)?.direction) || null;
                const key = txDirection || 'default';
                if (!groups[key]) groups[key] = [];
                groups[key].push(id);
            }

            // Send one request per direction group
            for (const [dirKey, ids] of Object.entries(groups)) {
                const direction = dirKey === 'default' ? null : dirKey;
                await bulkAssignBudget(ids, Number(assignCategoryId), direction);
            }

            setSelectedIds(new Set());
            setAssignCategoryId('');
            setDirectionOverrides({});
            await handlePreview();
            onMappingApplied();
        } catch (err) {
            setError(`Failed to assign: ${err.response?.data?.detail || err.message}`);
        } finally {
            setAssigning(false);
        }
    };

    const methodLabel = (method) => {
        const labels = {
            exact_category: 'Exact match',
            category_contains: 'Category contains',
            description_contains: 'Description match',
            remarks_contains: 'Remarks match',
            keyword_match: 'Keyword match',
        };
        return labels[method] || method;
    };

    return (
        <div className="card overflow-hidden">
            <button
                onClick={() => { setExpanded(!expanded); if (!expanded && !result) handlePreview(); }}
                className="w-full flex items-center justify-between px-6 py-3 bg-amber-50 hover:bg-amber-100 transition-colors border-b border-amber-200"
            >
                <div className="flex items-center gap-2">
                    <span className="text-amber-600 font-medium text-sm">Unmapped Transaction Scanner</span>
                    <span className="text-xs text-amber-500">Map older transactions to budget categories</span>
                </div>
                <svg className={cn("w-4 h-4 text-amber-600 transition-transform", expanded && "rotate-180")} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {expanded && (
                <div className="px-6 py-4 space-y-4">
                    {loading && (
                        <div className="text-center py-6">
                            <div className="skeleton h-5 w-48 mx-auto mb-2" />
                            <p className="text-xs text-gray-400">Scanning transactions...</p>
                        </div>
                    )}

                    {error && (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700">{error}</div>
                    )}

                    {result && !loading && (
                        <>
                            {/* Summary */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-gray-50 rounded-lg p-3 text-center">
                                    <p className="text-2xl font-bold text-gray-900">{result.total_unmapped}</p>
                                    <p className="text-xs text-gray-500">Unmapped</p>
                                </div>
                                <div className="bg-emerald-50 rounded-lg p-3 text-center">
                                    <p className="text-2xl font-bold text-emerald-700">{result.total_matched}</p>
                                    <p className="text-xs text-emerald-600">Can be mapped</p>
                                </div>
                                <div className="bg-amber-50 rounded-lg p-3 text-center">
                                    <p className="text-2xl font-bold text-amber-700">{result.total_unmatched}</p>
                                    <p className="text-xs text-amber-600">No match found</p>
                                </div>
                            </div>

                            {/* Applied confirmation */}
                            {!result.dry_run && result.updated > 0 && (
                                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700 font-medium">
                                    Successfully mapped {result.updated} transactions to budget categories. Budget report has been refreshed.
                                </div>
                            )}

                            {/* Category breakdown */}
                            {Object.keys(result.category_summary).length > 0 && (
                                <div>
                                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                                        {result.dry_run ? 'Proposed mappings by category:' : 'Mapped by category:'}
                                    </h4>
                                    <div className="space-y-1">
                                        {Object.entries(result.category_summary).map(([name, data]) => (
                                            <div key={name} className="flex items-center justify-between text-sm py-1 px-3 bg-gray-50 rounded">
                                                <span className="text-gray-700 font-medium">{name}</span>
                                                <span className="text-gray-500">
                                                    {data.count} tx &middot; {formatEUR(data.total_amount)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Detailed mappings table */}
                            {result.dry_run && result.mappings.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-medium text-gray-700 mb-2">Transaction details:</h4>
                                    <div className="max-h-60 overflow-auto border border-gray-200 rounded-lg">
                                        <table className="min-w-full text-xs">
                                            <thead className="bg-slate-50 sticky top-0">
                                                <tr>
                                                    <th className="px-3 py-2 text-left text-gray-500">Date</th>
                                                    <th className="px-3 py-2 text-left text-gray-500">From Account</th>
                                                    <th className="px-3 py-2 text-left text-gray-500">Description</th>
                                                    <th className="px-3 py-2 text-right text-gray-500">Amount</th>
                                                    <th className="px-3 py-2 text-left text-gray-500">Maps To</th>
                                                    <th className="px-3 py-2 text-left text-gray-500">Method</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {result.mappings.map(m => (
                                                    <tr key={m.transaction_id} className="hover:bg-gray-50">
                                                        <td className="px-3 py-1.5 whitespace-nowrap text-gray-600">
                                                            {m.date ? new Date(m.date).toLocaleDateString('en-GB') : '-'}
                                                        </td>
                                                        <td className="px-3 py-1.5 text-gray-500 max-w-[150px] truncate">
                                                            {m.from_account || '-'}
                                                        </td>
                                                        <td className="px-3 py-1.5 text-gray-600 max-w-[200px] truncate">
                                                            {m.description || m.category_field || '-'}
                                                        </td>
                                                        <td className="px-3 py-1.5 text-right font-medium text-gray-900 amount">
                                                            {formatEUR(m.amount)}
                                                        </td>
                                                        <td className="px-3 py-1.5">
                                                            <span className="inline-flex px-2 py-0.5 bg-primary-50 text-primary-700 rounded text-xs font-medium">
                                                                {m.mapped_to_name}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-1.5 text-gray-400">{methodLabel(m.match_method)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Unmatched transactions with bulk assign */}
                            {result.unmatched.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-medium text-amber-700 mb-2">
                                        Unmatched transactions — select and assign a budget category:
                                    </h4>
                                    <div className="flex items-center gap-2 mb-2">
                                        <select
                                            value={assignCategoryId}
                                            onChange={e => setAssignCategoryId(e.target.value)}
                                            className="input text-xs py-1.5 max-w-xs"
                                        >
                                            <option value="">Select budget category...</option>
                                            {categories
                                                .filter(c => {
                                                    if (selectedIds.size === 0) return true;
                                                    const selectedTxs = result?.unmatched?.filter(u => selectedIds.has(u.transaction_id)) || [];
                                                    const directions = new Set(selectedTxs.map(t => directionOverrides[t.transaction_id] ?? t.direction ?? 'out'));
                                                    if (directions.size === 1) {
                                                        const dir = [...directions][0];
                                                        if (dir === 'in') return c.category_type === 'income';
                                                        if (dir === 'out') return c.category_type !== 'income';
                                                    }
                                                    return true;
                                                })
                                                .map(c => (
                                                    <option key={c.id} value={c.id}>{c.category_name}</option>
                                                ))}
                                        </select>
                                        <button
                                            onClick={handleBulkAssign}
                                            disabled={assigning || !assignCategoryId || selectedIds.size === 0}
                                            className="btn-primary text-xs py-1.5"
                                        >
                                            {assigning ? 'Assigning...' : `Assign Selected (${selectedIds.size})`}
                                        </button>
                                    </div>
                                    <div className="max-h-60 overflow-auto border border-amber-200 rounded-lg">
                                        <table className="min-w-full text-xs">
                                            <thead className="bg-amber-50 sticky top-0">
                                                <tr>
                                                    <th className="px-2 py-2 text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedIds.size === result.unmatched.length && result.unmatched.length > 0}
                                                            onChange={toggleSelectAll}
                                                            className="rounded border-gray-300"
                                                        />
                                                    </th>
                                                    <th className="px-3 py-2 text-left text-gray-500">Date</th>
                                                    <th className="px-3 py-2 text-left text-gray-500">From Account</th>
                                                    <th className="px-3 py-2 text-left text-gray-500">Category</th>
                                                    <th className="px-3 py-2 text-left text-gray-500">Description</th>
                                                    <th className="px-3 py-2 text-left text-gray-500">To Account</th>
                                                    <th className="px-3 py-2 text-right text-gray-500">Amount</th>
                                                    <th className="px-3 py-2 text-left text-gray-500">Type</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-amber-100">
                                                {result.unmatched.map(u => (
                                                    <tr key={u.transaction_id} className={cn("hover:bg-amber-50/50", selectedIds.has(u.transaction_id) && "bg-amber-50")}>
                                                        <td className="px-2 py-1.5 text-center">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedIds.has(u.transaction_id)}
                                                                onChange={() => toggleSelect(u.transaction_id)}
                                                                className="rounded border-gray-300"
                                                            />
                                                        </td>
                                                        <td className="px-3 py-1.5 whitespace-nowrap text-gray-600">
                                                            {u.date ? new Date(u.date).toLocaleDateString('en-GB') : '-'}
                                                        </td>
                                                        <td className="px-3 py-1.5 text-gray-500 max-w-[150px] truncate">
                                                            {u.from_account || '-'}
                                                        </td>
                                                        <td className="px-3 py-1.5 text-gray-500 max-w-[120px] truncate">
                                                            {u.category_field || '-'}
                                                        </td>
                                                        <td className="px-3 py-1.5 text-gray-600 max-w-[200px] truncate">
                                                            {u.description || '-'}
                                                        </td>
                                                        <td className="px-3 py-1.5 text-gray-500 max-w-[150px] truncate">
                                                            {u.to_account || '-'}
                                                        </td>
                                                        <td className="px-3 py-1.5 text-right font-medium text-gray-900 amount">
                                                            {formatEUR(u.amount)}
                                                        </td>
                                                        <td className="px-3 py-1.5">
                                                            <select
                                                                value={directionOverrides[u.transaction_id] ?? u.direction ?? 'out'}
                                                                onChange={e => setDirectionOverrides(prev => ({ ...prev, [u.transaction_id]: e.target.value }))}
                                                                className="input text-xs py-0.5 px-1 w-24"
                                                            >
                                                                <option value="out">Expense</option>
                                                                <option value="in">Income</option>
                                                            </select>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Action buttons */}
                            <div className="flex items-center gap-3 pt-2">
                                {result.dry_run && result.total_matched > 0 && (
                                    <button
                                        onClick={handleApply}
                                        disabled={applying}
                                        className="btn-primary text-sm"
                                    >
                                        {applying ? 'Applying...' : `Apply ${result.total_matched} Mappings`}
                                    </button>
                                )}
                                <button
                                    onClick={handlePreview}
                                    disabled={loading}
                                    className="btn-secondary text-sm"
                                >
                                    {loading ? 'Scanning...' : 'Re-scan'}
                                </button>
                                {scanMessage && (
                                    <span className="text-sm text-emerald-600 font-medium animate-pulse">{scanMessage}</span>
                                )}
                                {result.total_unmapped === 0 && (
                                    <span className="text-sm text-emerald-600 font-medium">All transactions are mapped!</span>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}
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
    const [drilldownCategory, setDrilldownCategory] = useState(null);
    const [drilldownTransactions, setDrilldownTransactions] = useState([]);
    const [drilldownLoading, setDrilldownLoading] = useState(false);

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

    const handleActualClick = async (item) => {
        setDrilldownCategory(item);
        setDrilldownLoading(true);
        setDrilldownTransactions([]);
        try {
            const result = await getTransactions({
                budget_item_id: item.id,
                project_id: selectedProjectId,
                limit: 200,
            });
            setDrilldownTransactions(result.items || []);
        } catch (error) {
            console.error("Failed to load drill-down transactions", error);
        } finally {
            setDrilldownLoading(false);
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

            {/* Budget Mapper Panel */}
            {selectedProjectId && (
                <BudgetMapperPanel projectId={selectedProjectId} onMappingApplied={loadReportData} />
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
                                                    {isChild && item.actual > 0 ? (
                                                        <button
                                                            onClick={() => handleActualClick(item)}
                                                            className="text-primary-600 hover:text-primary-800 underline decoration-dotted underline-offset-2 cursor-pointer"
                                                        >
                                                            {formatEURDecimal(item.actual)}
                                                        </button>
                                                    ) : (
                                                        formatEURDecimal(item.actual)
                                                    )}
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

            {/* Drill-down Modal */}
            {drilldownCategory && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
                    onClick={() => setDrilldownCategory(null)}
                >
                    <div
                        className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col mx-4"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-900">
                                Transactions: {drilldownCategory.name}
                            </h3>
                            <button
                                onClick={() => setDrilldownCategory(null)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                            >
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="overflow-auto flex-1">
                            {drilldownLoading ? (
                                <div className="px-6 py-12 text-center">
                                    <div className="skeleton h-6 w-48 mx-auto mb-3" />
                                    <div className="skeleton h-4 w-32 mx-auto" />
                                </div>
                            ) : drilldownTransactions.length === 0 ? (
                                <div className="px-6 py-12 text-center text-gray-400 text-sm">
                                    No transactions found for this category.
                                </div>
                            ) : (
                                <table className="min-w-full divide-y divide-gray-200 text-sm">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {drilldownTransactions.map(tx => (
                                            <tr key={tx.id} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 whitespace-nowrap text-gray-900">
                                                    {new Date(tx.date).toLocaleDateString('en-GB')}
                                                </td>
                                                <td className="px-4 py-3 text-gray-500 max-w-[250px] truncate">
                                                    {tx.remarks || tx.description || '-'}
                                                </td>
                                                <td className={cn(
                                                    "px-4 py-3 whitespace-nowrap text-right font-semibold amount",
                                                    tx.type === 'income' ? "text-emerald-600" : "text-rose-600"
                                                )}>
                                                    {formatEUR(tx.amount)}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <span className={cn(
                                                        "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full",
                                                        tx.type === 'income'
                                                            ? "bg-emerald-50 text-emerald-700"
                                                            : "bg-rose-50 text-rose-700"
                                                    )}>
                                                        {tx.type === 'income' ? 'Income' : 'Expense'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BudgetReport;
