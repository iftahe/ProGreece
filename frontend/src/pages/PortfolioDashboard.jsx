import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
    ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { getPortfolioSummary } from '../api';
import { useProject } from '../contexts/ProjectContext';
import { PortfolioIcon, AlertIcon, ApartmentsIcon, BudgetIcon, BalanceIcon } from '../components/Icons';
import { cn, formatEUR, formatPercent } from '../lib/utils';

const KpiCard = ({ label, value, subtitle, colorClass, bgClass, icon: Icon }) => (
    <div className="card-elevated p-5 flex items-start gap-4">
        <div className={cn("rounded-lg p-3", bgClass)}>
            <Icon className={cn("w-6 h-6", colorClass)} />
        </div>
        <div className="min-w-0">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-2xl font-bold text-gray-900 amount">{value}</p>
            {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
    </div>
);

const HealthBadge = ({ score }) => {
    const config = score >= 80
        ? { label: 'Healthy', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' }
        : score >= 60
        ? { label: 'Warning', bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' }
        : { label: 'At Risk', bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500' };

    return (
        <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold', config.bg, config.text)}>
            <span className={cn('w-1.5 h-1.5 rounded-full', config.dot)} />
            {score}/100 {config.label}
        </span>
    );
};

const SkeletonPortfolio = () => (
    <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
                <div key={i} className="card-elevated p-5 flex items-center gap-4">
                    <div className="skeleton w-12 h-12 rounded-lg" />
                    <div className="space-y-2 flex-1">
                        <div className="skeleton h-3 w-20" />
                        <div className="skeleton h-6 w-28" />
                    </div>
                </div>
            ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 card-elevated p-6">
                <div className="skeleton h-6 w-48 mb-4" />
                <div className="skeleton h-72 w-full rounded-lg" />
            </div>
            <div className="card-elevated p-6">
                <div className="skeleton h-6 w-40 mb-4" />
                <div className="space-y-3">
                    {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-14 w-full rounded" />)}
                </div>
            </div>
        </div>
    </div>
);

const PortfolioDashboard = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const { selectProject } = useProject();
    const [searchParams] = useSearchParams();

    useEffect(() => {
        getPortfolioSummary()
            .then(setData)
            .catch(err => console.error("Failed to load portfolio summary", err))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <SkeletonPortfolio />;
    if (!data) return <p className="text-gray-500">Failed to load data.</p>;

    const { projects, totals } = data;

    // Build aggregated 12-month cash flow from all projects
    const aggregatedCashFlow = {};
    projects.forEach(proj => {
        (proj.cash_flow || []).forEach(row => {
            if (!aggregatedCashFlow[row.date]) {
                aggregatedCashFlow[row.date] = { date: row.date, income: 0, expense: 0, balance: 0 };
            }
            aggregatedCashFlow[row.date].income += (row.actual_income || 0) + (row.planned_income || 0);
            aggregatedCashFlow[row.date].expense += (row.actual_expense || 0) + (row.planned_expense || 0);
        });
    });
    const cashFlowData = Object.values(aggregatedCashFlow)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((row, i, arr) => {
            const cumulative = arr.slice(0, i + 1).reduce((sum, r) => sum + r.income - r.expense, 0);
            return { ...row, net: row.income - row.expense, balance: cumulative };
        });

    // Collect alerts
    const alerts = [];
    projects.forEach(proj => {
        if (proj.worst_category) {
            alerts.push({
                type: 'danger',
                text: `${proj.worst_category.name} - ${proj.name}`,
                detail: `${proj.worst_category.progress}% (${formatEUR(proj.worst_category.overrun)} overrun)`,
            });
        }
        if (proj.categories_warning > 0) {
            alerts.push({
                type: 'warning',
                text: `${proj.categories_warning} categories over 90% - ${proj.name}`,
                detail: 'Requires monitoring',
            });
        }
    });

    const projectParam = searchParams.get('project');
    const buildHref = (path, projectId) => {
        return `${path}?project=${projectId}`;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">{'Portfolio Overview'}</h1>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                    icon={PortfolioIcon}
                    label={'Active Projects'}
                    value={totals.project_count}
                    colorClass="text-primary-600"
                    bgClass="bg-primary-50"
                />
                <KpiCard
                    icon={BalanceIcon}
                    label={'Total Budget'}
                    value={formatEUR(totals.total_budget)}
                    subtitle={`${formatPercent(totals.budget_progress)}% utilized`}
                    colorClass="text-blue-600"
                    bgClass="bg-blue-50"
                />
                <KpiCard
                    icon={ApartmentsIcon}
                    label={'Collections'}
                    value={formatEUR(totals.total_collected)}
                    subtitle={`${formatPercent(totals.collection_rate)}% of ${formatEUR(totals.total_revenue)}`}
                    colorClass="text-emerald-600"
                    bgClass="bg-emerald-50"
                />
                <KpiCard
                    icon={BudgetIcon}
                    label={'Actual Expenses'}
                    value={formatEUR(totals.total_spent)}
                    subtitle={`of ${formatEUR(totals.total_budget)} budget`}
                    colorClass="text-rose-600"
                    bgClass="bg-rose-50"
                />
            </div>

            {/* Charts + Alerts row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 12-Month Cash Flow Chart */}
                <div className="lg:col-span-2 card-elevated p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">{'12-Month Cash Flow'}</h2>
                    {cashFlowData.length > 0 ? (
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={cashFlowData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                                    <YAxis tick={{ fontSize: 12 }} />
                                    <Tooltip
                                        formatter={(value) => formatEUR(value)}
                                        contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                                    />
                                    <Legend />
                                    <ReferenceLine y={0} stroke="#94a3b8" />
                                    <Bar dataKey="income" fill="#10b981" barSize={24} name={'Income'} radius={[3, 3, 0, 0]} />
                                    <Bar dataKey="expense" fill="#ef4444" barSize={24} name={'Expenses'} radius={[3, 3, 0, 0]} />
                                    <Line type="monotone" dataKey="balance" stroke="#6366f1" strokeWidth={2.5} dot={false} name={'Cumulative Balance'} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <p className="text-gray-400 text-sm text-center py-12">{'No cash flow data'}</p>
                    )}
                </div>

                {/* Alerts panel */}
                <div className="card-elevated p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">{'Alerts'}</h2>
                    {alerts.length === 0 ? (
                        <div className="text-center py-8">
                            <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                                <span className="text-emerald-600 text-xl">&#10003;</span>
                            </div>
                            <p className="text-sm text-gray-500">{'All clear'}</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {alerts.map((alert, i) => (
                                <div key={i} className={cn(
                                    'flex items-start gap-3 p-3 rounded-lg text-sm',
                                    alert.type === 'danger' ? 'bg-rose-50' : 'bg-amber-50'
                                )}>
                                    <AlertIcon className={cn('w-5 h-5 flex-shrink-0 mt-0.5', alert.type === 'danger' ? 'text-rose-500' : 'text-amber-500')} />
                                    <div>
                                        <p className={cn('font-medium', alert.type === 'danger' ? 'text-rose-700' : 'text-amber-700')}>
                                            {alert.text}
                                        </p>
                                        <p className={cn('text-xs', alert.type === 'danger' ? 'text-rose-500' : 'text-amber-500')}>
                                            {alert.detail}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Project Comparison Table */}
            <div className="card-elevated overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900">{'Project Comparison'}</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{'Project'}</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{'Budget'}</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{'Expenses'}</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{'Collections'}</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-36">{'Collection %'}</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{'Net Cash Flow'}</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{'Budget Health'}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                            {projects.map((proj) => (
                                <tr key={proj.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <Link
                                            to={buildHref('/dashboard', proj.id)}
                                            onClick={() => selectProject(proj.id)}
                                            className="font-semibold text-primary-600 hover:text-primary-800"
                                        >
                                            {proj.name}
                                        </Link>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right font-mono">{formatEUR(proj.total_budget)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right font-mono">{formatEUR(proj.actual_spent)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right font-mono">{formatEUR(proj.total_collected)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                                                <div
                                                    className="h-2 rounded-full bg-emerald-500 transition-all"
                                                    style={{ width: `${Math.min(proj.collection_rate, 100)}%` }}
                                                />
                                            </div>
                                            <span className="text-xs w-12 text-right font-medium text-gray-600">
                                                {formatPercent(proj.collection_rate)}%
                                            </span>
                                        </div>
                                    </td>
                                    <td className={cn(
                                        "px-6 py-4 whitespace-nowrap text-right font-bold font-mono",
                                        proj.net_cash_flow >= 0 ? 'text-emerald-600' : 'text-rose-600'
                                    )}>
                                        {proj.net_cash_flow >= 0 ? '+' : ''}{formatEUR(proj.net_cash_flow)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                        <HealthBadge score={proj.budget_health} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default PortfolioDashboard;