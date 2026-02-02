import React, { useEffect, useState } from 'react';
import {
    ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { getCashFlowForecast, getProjects } from '../api';
import { IncomeIcon, ExpenseIcon, NetFlowIcon, BalanceIcon } from '../components/Icons';
import { cn, formatEUR } from '../lib/utils';

const KpiCard = ({ icon: Icon, label, value, colorClass, bgClass }) => (
    <div className="card p-5 flex items-center gap-4">
        <div className={cn("rounded-lg p-3", bgClass)}>
            <Icon className={cn("w-6 h-6", colorClass)} />
        </div>
        <div>
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-xl font-bold text-gray-900">{value}</p>
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
        <div className="card p-6">
            <div className="skeleton h-6 w-48 mb-4" />
            <div className="skeleton h-96 w-full rounded-lg" />
        </div>
    </div>
);

const Dashboard = () => {
    const [data, setData] = useState([]);
    const [projects, setProjects] = useState([]);
    const [selectedProjectId, setSelectedProjectId] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getProjects().then((projs) => {
            setProjects(projs);
            if (projs.length > 0) {
                setSelectedProjectId(projs[0].id);
            } else {
                setLoading(false);
            }
        });
    }, []);

    useEffect(() => {
        if (selectedProjectId) {
            setLoading(true);
            getCashFlowForecast(selectedProjectId)
                .then((response) => {
                    const chartData = response.map(item => {
                        const totalIncome = (item.actual_income || 0) + (item.planned_income || 0);
                        const totalExpense = (item.actual_expense || 0) + (item.planned_expense || 0);
                        return {
                            ...item,
                            name: item.date,
                            Income: totalIncome,
                            Expense: totalExpense,
                            Net: item.net_flow,
                            Balance: item.cumulative_balance
                        };
                    });
                    setData(chartData);
                    setLoading(false);
                })
                .catch(err => {
                    console.error("Failed to fetch forecast", err);
                    setLoading(false);
                });
        }
    }, [selectedProjectId]);

    const totals = data.reduce((acc, row) => ({
        income: acc.income + row.Income,
        expense: acc.expense + row.Expense,
        net: acc.net + row.Net,
    }), { income: 0, expense: 0, net: 0 });
    const balance = data.length > 0 ? data[data.length - 1].Balance : 0;

    if (loading && !selectedProjectId) return <SkeletonDashboard />;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">Cash Flow Dashboard</h1>
                <select
                    className="input-field w-auto min-w-[200px]"
                    value={selectedProjectId || ''}
                    onChange={(e) => setSelectedProjectId(Number(e.target.value))}
                >
                    {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
            </div>

            {/* KPI Cards */}
            {!loading && data.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <KpiCard icon={IncomeIcon} label="Total Income" value={formatEUR(totals.income)} colorClass="text-income" bgClass="bg-emerald-50" />
                    <KpiCard icon={ExpenseIcon} label="Total Expenses" value={formatEUR(totals.expense)} colorClass="text-expense" bgClass="bg-rose-50" />
                    <KpiCard icon={NetFlowIcon} label="Net Cash Flow" value={formatEUR(totals.net)} colorClass={totals.net >= 0 ? 'text-income' : 'text-expense'} bgClass={totals.net >= 0 ? 'bg-emerald-50' : 'bg-rose-50'} />
                    <KpiCard icon={BalanceIcon} label="Current Balance" value={formatEUR(balance)} colorClass="text-primary-600" bgClass="bg-primary-50" />
                </div>
            )}

            {/* Chart */}
            <div className="card p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Cash Flow Forecast</h2>
                {loading ? (
                    <div className="skeleton h-96 w-full rounded-lg" />
                ) : (
                    <div className="h-96 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={data}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                <YAxis tick={{ fontSize: 12 }} />
                                <Tooltip formatter={(value) => formatEUR(value)} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                                <Legend />
                                <ReferenceLine y={0} stroke="#94a3b8" />
                                <Bar dataKey="Income" fill="#10b981" barSize={30} name="Income" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="Expense" fill="#f43f5e" barSize={30} name="Expense" radius={[4, 4, 0, 0]} />
                                <Line type="monotone" dataKey="Balance" stroke="#6366f1" strokeWidth={3} dot={{ r: 4 }} name="Cumulative Balance" />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            {/* Data Table */}
            <div className="card overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900">Detailed Breakdown</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Act. Income</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Plan. Income</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-emerald-700 uppercase tracking-wider bg-emerald-50/50">Total Income</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Act. Expense</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Plan. Expense</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-rose-700 uppercase tracking-wider bg-rose-50/50">Total Expense</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-900 uppercase tracking-wider">Net Flow</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-primary-700 uppercase tracking-wider">Balance</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                            {data.map((row, index) => (
                                <tr key={row.name} className={cn("hover:bg-gray-50", index % 2 !== 0 && "bg-slate-50/50")}>
                                    <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">{row.date}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-right text-gray-600">{formatEUR(row.actual_income)}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-right text-gray-600">{formatEUR(row.planned_income)}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-right font-medium text-emerald-600 bg-emerald-50/30">{formatEUR(row.Income)}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-right text-gray-600">{formatEUR(row.actual_expense)}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-right text-gray-600">{formatEUR(row.planned_expense)}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-right font-medium text-rose-600 bg-rose-50/30">{formatEUR(row.Expense)}</td>
                                    <td className={cn("px-4 py-3 whitespace-nowrap text-right font-bold", row.Net >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
                                        {formatEUR(row.Net)}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-right font-bold text-primary-700">{formatEUR(row.Balance)}</td>
                                </tr>
                            ))}
                            {data.length > 0 && (
                                <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                                    <td className="px-4 py-3 text-gray-700">Total</td>
                                    <td className="px-4 py-3 text-right text-gray-700">{formatEUR(data.reduce((s, r) => s + r.actual_income, 0))}</td>
                                    <td className="px-4 py-3 text-right text-gray-700">{formatEUR(data.reduce((s, r) => s + r.planned_income, 0))}</td>
                                    <td className="px-4 py-3 text-right text-emerald-700">{formatEUR(totals.income)}</td>
                                    <td className="px-4 py-3 text-right text-gray-700">{formatEUR(data.reduce((s, r) => s + r.actual_expense, 0))}</td>
                                    <td className="px-4 py-3 text-right text-gray-700">{formatEUR(data.reduce((s, r) => s + r.planned_expense, 0))}</td>
                                    <td className="px-4 py-3 text-right text-rose-700">{formatEUR(totals.expense)}</td>
                                    <td className={cn("px-4 py-3 text-right", totals.net >= 0 ? 'text-emerald-700' : 'text-rose-700')}>{formatEUR(totals.net)}</td>
                                    <td className="px-4 py-3 text-right text-primary-700">{formatEUR(balance)}</td>
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
