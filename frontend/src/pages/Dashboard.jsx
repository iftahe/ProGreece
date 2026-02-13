import React, { useEffect, useState, useMemo } from 'react';
import {
    ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { getCashFlowForecast, getProjectKpiSummary } from '../api';
import { useProject } from '../contexts/ProjectContext';
import { IncomeIcon, ExpenseIcon, NetFlowIcon, BalanceIcon, ApartmentsIcon, ShieldCheckIcon, CalendarPlanIcon } from '../components/Icons';
import { cn, formatEUR, formatPercent } from '../lib/utils';

const QUARTER_MONTHS = {
    Q1: ['01', '02', '03'],
    Q2: ['04', '05', '06'],
    Q3: ['07', '08', '09'],
    Q4: ['10', '11', '12'],
};

const KpiCard = ({ icon: Icon, label, value, trend, colorClass, bgClass }) => (
    <div className="card-elevated p-5 flex items-center gap-4">
        <div className={cn("rounded-lg p-3", bgClass)}>
            <Icon className={cn("w-6 h-6", colorClass)} />
        </div>
        <div className="min-w-0">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-xl font-bold text-gray-900 amount">{value}</p>
            {trend !== undefined && trend !== null && (
                <p className={cn("text-xs font-medium mt-0.5", trend >= 0 ? "text-emerald-600" : "text-rose-600")}>
                    {trend >= 0 ? '\u2191' : '\u2193'} {formatPercent(Math.abs(trend))}% vs forecast
                </p>
            )}
        </div>
    </div>
);

const SkeletonDashboard = () => (
    <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
                <div key={i} className="card p-5 flex items-center gap-4">
                    <div className="skeleton w-12 h-12 rounded-lg" />
                    <div className="space-y-2">
                        <div className="skeleton h-3 w-20" />
                        <div className="skeleton h-5 w-28" />
                    </div>
                </div>
            ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
                <div key={i} className="card p-5">
                    <div className="skeleton h-5 w-32 mb-3" />
                    <div className="skeleton h-8 w-24 mb-2" />
                    <div className="skeleton h-2 w-full" />
                </div>
            ))}
        </div>
        <div className="card p-6">
            <div className="skeleton h-6 w-48 mb-4" />
            <div className="skeleton h-96 w-full rounded-lg" />
        </div>
    </div>
);

const Dashboard = () => {
    const { selectedProjectId, selectedProject } = useProject();
    const [data, setData] = useState([]);
    const [kpiData, setKpiData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState('all');
    const [viewMode, setViewMode] = useState('monthly');

    useEffect(() => {
        if (selectedProjectId) {
            setLoading(true);
            Promise.all([
                getCashFlowForecast(selectedProjectId),
                getProjectKpiSummary(selectedProjectId).catch(() => null),
            ]).then(([cashFlow, kpi]) => {
                const chartData = cashFlow.map(item => ({
                    ...item,
                    name: item.date,
                    Income: (item.actual_income || 0) + (item.planned_income || 0),
                    Expense: (item.actual_expense || 0) + (item.planned_expense || 0),
                    Net: item.net_flow,
                    Balance: item.cumulative_balance,
                }));
                setData(chartData);
                setKpiData(kpi);
                setLoading(false);
            }).catch(err => {
                console.error("Failed to fetch dashboard data", err);
                setLoading(false);
            });
        } else {
            setLoading(false);
        }
    }, [selectedProjectId]);

    // Compute totals & trends
    const totals = data.reduce((acc, row) => ({
        income: acc.income + row.Income,
        expense: acc.expense + row.Expense,
        net: acc.net + row.Net,
        actual_income: acc.actual_income + (row.actual_income || 0),
        planned_income: acc.planned_income + (row.planned_income || 0),
        actual_expense: acc.actual_expense + (row.actual_expense || 0),
        planned_expense: acc.planned_expense + (row.planned_expense || 0),
    }), { income: 0, expense: 0, net: 0, actual_income: 0, planned_income: 0, actual_expense: 0, planned_expense: 0 });

    const balance = data.length > 0 ? data[data.length - 1].Balance : 0;

    const incomeTrend = totals.planned_income > 0
        ? ((totals.actual_income - totals.planned_income) / totals.planned_income) * 100
        : null;
    const expenseTrend = totals.planned_expense > 0
        ? ((totals.actual_expense - totals.planned_expense) / totals.planned_expense) * 100
        : null;

    // Filter and aggregate based on timeRange and viewMode
    const chartData = useMemo(() => {
        let filtered = [...data];

        if (timeRange !== 'all') {
            const months = QUARTER_MONTHS[timeRange];
            filtered = filtered.filter(row => {
                const month = row.date?.split('-')[1];
                return months.includes(month);
            });
        }

        if (viewMode === 'quarterly') {
            const quarterMap = {};
            filtered.forEach(row => {
                const [year, month] = row.date.split('-');
                const q = `Q${Math.ceil(parseInt(month) / 3)}`;
                const key = `${year} ${q}`;
                if (!quarterMap[key]) {
                    quarterMap[key] = {
                        date: key, name: key,
                        actual_income: 0, planned_income: 0,
                        actual_expense: 0, planned_expense: 0,
                        Income: 0, Expense: 0, Net: 0, Balance: 0,
                    };
                }
                quarterMap[key].actual_income += row.actual_income || 0;
                quarterMap[key].planned_income += row.planned_income || 0;
                quarterMap[key].actual_expense += row.actual_expense || 0;
                quarterMap[key].planned_expense += row.planned_expense || 0;
                quarterMap[key].Income += row.Income || 0;
                quarterMap[key].Expense += row.Expense || 0;
                quarterMap[key].Net += row.Net || 0;
                quarterMap[key].Balance = row.Balance;
            });
            filtered = Object.values(quarterMap);
        }

        return filtered;
    }, [data, timeRange, viewMode]);

    if (loading && !selectedProjectId) return <SkeletonDashboard />;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">
                    {'Dashboard'} {selectedProject ? `- ${selectedProject.name}` : ''}
                </h1>
            </div>

            {/* KPI Cards Row 1 - Cash Flow Summary */}
            {!loading && data.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <KpiCard icon={IncomeIcon} label={'Total Income'} value={formatEUR(totals.income)}
                        trend={incomeTrend} colorClass="text-income" bgClass="bg-emerald-50" />
                    <KpiCard icon={ExpenseIcon} label={'Total Expenses'} value={formatEUR(totals.expense)}
                        trend={expenseTrend} colorClass="text-expense" bgClass="bg-rose-50" />
                    <KpiCard icon={NetFlowIcon} label={'Net Cash Flow'} value={formatEUR(totals.net)}
                        colorClass={totals.net >= 0 ? 'text-income' : 'text-expense'}
                        bgClass={totals.net >= 0 ? 'bg-emerald-50' : 'bg-rose-50'} />
                    <KpiCard icon={BalanceIcon} label={'Current Balance'} value={formatEUR(balance)}
                        colorClass="text-primary-600" bgClass="bg-primary-50" />
                </div>
            )}

            {/* KPI Cards Row 2 - Actionable Insights */}
            {!loading && kpiData && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Collection Progress */}
                    <div className="card-elevated p-5">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="rounded-lg p-2.5 bg-emerald-50">
                                <ApartmentsIcon className="w-5 h-5 text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">{'Collection Progress'}</p>
                                <p className="text-2xl font-bold text-gray-900 amount">
                                    {formatPercent(kpiData.collection.collection_percent)}%
                                </p>
                            </div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                            <div className="h-2.5 rounded-full bg-emerald-500 transition-all"
                                style={{ width: `${Math.min(kpiData.collection.collection_percent, 100)}%` }} />
                        </div>
                        <p className="text-xs text-gray-500">
                            {formatEUR(kpiData.collection.total_collected)} / {formatEUR(kpiData.collection.total_revenue)} collected
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                            {kpiData.collection.fully_paid} fully paid &middot; {kpiData.collection.outstanding} outstanding
                        </p>
                    </div>

                    {/* Next Month Projection */}
                    <div className="card-elevated p-5">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="rounded-lg p-2.5 bg-blue-50">
                                <CalendarPlanIcon className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">{kpiData.next_month.month} {'Projection'}</p>
                                <p className={cn("text-2xl font-bold amount",
                                    kpiData.next_month.gap >= 0 ? "text-emerald-600" : "text-rose-600"
                                )}>
                                    {kpiData.next_month.gap >= 0 ? '+' : ''}{formatEUR(kpiData.next_month.gap)}
                                </p>
                            </div>
                        </div>
                        <div className="space-y-1 text-xs">
                            <div className="flex justify-between">
                                <span className="text-gray-500">{'Income'}</span>
                                <span className="text-emerald-600 font-medium amount">{formatEUR(kpiData.next_month.projected_income)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">{'Expenses'}</span>
                                <span className="text-rose-600 font-medium amount">{formatEUR(kpiData.next_month.projected_expense)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Budget Health */}
                    <div className="card-elevated p-5">
                        <div className="flex items-center gap-3 mb-3">
                            <div className={cn("rounded-lg p-2.5",
                                kpiData.budget_health.score >= 80 ? "bg-emerald-50" :
                                kpiData.budget_health.score >= 60 ? "bg-amber-50" : "bg-rose-50"
                            )}>
                                <ShieldCheckIcon className={cn("w-5 h-5",
                                    kpiData.budget_health.score >= 80 ? "text-emerald-600" :
                                    kpiData.budget_health.score >= 60 ? "text-amber-600" : "text-rose-600"
                                )} />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">{'Budget Health'}</p>
                                <p className="text-2xl font-bold text-gray-900">{kpiData.budget_health.score}/100</p>
                            </div>
                            <span className={cn(
                                "ml-auto px-2.5 py-1 rounded-full text-xs font-semibold",
                                kpiData.budget_health.score >= 80 ? "bg-emerald-50 text-emerald-700" :
                                kpiData.budget_health.score >= 60 ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"
                            )}>
                                {kpiData.budget_health.score >= 80 ? 'Good' : kpiData.budget_health.score >= 60 ? 'Warning' : 'At Risk'}
                            </span>
                        </div>
                        <div className="space-y-1 text-xs">
                            {kpiData.budget_health.categories_ok > 0 && (
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                    <span className="text-gray-600">{kpiData.budget_health.categories_ok} {'on track'}</span>
                                </div>
                            )}
                            {kpiData.budget_health.categories_warning > 0 && (
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                                    <span className="text-gray-600">{kpiData.budget_health.categories_warning} {'over 90%'}</span>
                                </div>
                            )}
                            {kpiData.budget_health.categories_over > 0 && (
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                                    <span className="text-gray-600">{kpiData.budget_health.categories_over} {'over budget'}</span>
                                </div>
                            )}
                            {kpiData.budget_health.worst_category && (
                                <p className="text-rose-500 mt-1">
                                    {'Risk:'} {kpiData.budget_health.worst_category.name} ({kpiData.budget_health.worst_category.progress}%)
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Chart with Controls */}
            <div className="card p-6">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                    <h2 className="text-lg font-semibold text-gray-900">{'Cash Flow Forecast'}</h2>
                    <div className="flex items-center gap-2">
                        {/* Monthly/Quarterly toggle */}
                        <div className="flex bg-gray-100 rounded-lg p-0.5">
                            <button
                                onClick={() => setViewMode('monthly')}
                                className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                                    viewMode === 'monthly' ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                                )}
                            >{'Monthly'}</button>
                            <button
                                onClick={() => setViewMode('quarterly')}
                                className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                                    viewMode === 'quarterly' ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                                )}
                            >{'Quarterly'}</button>
                        </div>

                        {/* Quarter zoom */}
                        <div className="flex bg-gray-100 rounded-lg p-0.5">
                            {['all', 'Q1', 'Q2', 'Q3', 'Q4'].map(range => (
                                <button key={range}
                                    onClick={() => setTimeRange(range)}
                                    className={cn("px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors",
                                        timeRange === range ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                                    )}
                                >{range === 'all' ? 'Full Year' : range}</button>
                            ))}
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="skeleton h-96 w-full rounded-lg" />
                ) : (
                    <div className="h-96 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                <YAxis tick={{ fontSize: 12 }} />
                                <Tooltip
                                    formatter={(value) => formatEUR(value)}
                                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                                />
                                <Legend />
                                <ReferenceLine y={0} stroke="#94a3b8" />
                                <Bar dataKey="actual_income" stackId="income" fill="#10b981" barSize={30}
                                    name={'Actual Income'} radius={[0, 0, 0, 0]} />
                                <Bar dataKey="planned_income" stackId="income" fill="rgba(16,185,129,0.35)" barSize={30}
                                    name={'Planned Income'} radius={[4, 4, 0, 0]} />
                                <Bar dataKey="actual_expense" stackId="expense" fill="#dc2626" barSize={30}
                                    name={'Actual Expense'} radius={[0, 0, 0, 0]} />
                                <Bar dataKey="planned_expense" stackId="expense" fill="rgba(220,38,38,0.35)" barSize={30}
                                    name={'Planned Expense'} radius={[4, 4, 0, 0]} />
                                <Line type="monotone" dataKey="Balance" stroke="#6366f1" strokeWidth={3}
                                    dot={{ r: 4 }} name={'Cumulative Balance'} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            {/* Data Table */}
            <div className="card overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900">{'Detailed Breakdown'}</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{'Date'}</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{'Actual Income'}</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{'Planned Income'}</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-emerald-700 uppercase tracking-wider bg-emerald-50/50">{'Total Income'}</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{'Actual Expense'}</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{'Planned Expense'}</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-rose-700 uppercase tracking-wider bg-rose-50/50">{'Total Expenses'}</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-900 uppercase tracking-wider">{'Net Cash Flow'}</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-primary-700 uppercase tracking-wider">{'Balance'}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                            {chartData.map((row, index) => (
                                <tr key={row.name} className={cn("hover:bg-gray-50", index % 2 !== 0 && "bg-slate-50/50")}>
                                    <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">{row.date}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-right text-gray-600 amount">{formatEUR(row.actual_income)}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-right text-gray-600 amount">{formatEUR(row.planned_income)}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-right font-medium text-emerald-600 bg-emerald-50/30 amount">{formatEUR(row.Income)}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-right text-gray-600 amount">{formatEUR(row.actual_expense)}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-right text-gray-600 amount">{formatEUR(row.planned_expense)}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-right font-medium text-rose-600 bg-rose-50/30 amount">{formatEUR(row.Expense)}</td>
                                    <td className={cn("px-4 py-3 whitespace-nowrap text-right font-bold amount", row.Net >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
                                        {formatEUR(row.Net)}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-right font-bold text-primary-700 amount">{formatEUR(row.Balance)}</td>
                                </tr>
                            ))}
                            {chartData.length > 0 && (
                                <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                                    <td className="px-4 py-3 text-gray-700">{'Total'}</td>
                                    <td className="px-4 py-3 text-right text-gray-700 amount">{formatEUR(chartData.reduce((s, r) => s + (r.actual_income || 0), 0))}</td>
                                    <td className="px-4 py-3 text-right text-gray-700 amount">{formatEUR(chartData.reduce((s, r) => s + (r.planned_income || 0), 0))}</td>
                                    <td className="px-4 py-3 text-right text-emerald-700 amount">{formatEUR(chartData.reduce((s, r) => s + (r.Income || 0), 0))}</td>
                                    <td className="px-4 py-3 text-right text-gray-700 amount">{formatEUR(chartData.reduce((s, r) => s + (r.actual_expense || 0), 0))}</td>
                                    <td className="px-4 py-3 text-right text-gray-700 amount">{formatEUR(chartData.reduce((s, r) => s + (r.planned_expense || 0), 0))}</td>
                                    <td className="px-4 py-3 text-right text-rose-700 amount">{formatEUR(chartData.reduce((s, r) => s + (r.Expense || 0), 0))}</td>
                                    <td className={cn("px-4 py-3 text-right amount",
                                        chartData.reduce((s, r) => s + (r.Net || 0), 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'
                                    )}>
                                        {formatEUR(chartData.reduce((s, r) => s + (r.Net || 0), 0))}
                                    </td>
                                    <td className="px-4 py-3 text-right text-primary-700 amount">
                                        {chartData.length > 0 ? formatEUR(chartData[chartData.length - 1].Balance) : formatEUR(0)}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
