import React, { useEffect, useState } from 'react';
import {
    ComposedChart,
    Bar,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ReferenceLine
} from 'recharts';
import { getCashFlowForecast, getProjects } from '../api';

const Dashboard = () => {
    const [data, setData] = useState([]);
    const [projects, setProjects] = useState([]);
    const [selectedProjectId, setSelectedProjectId] = useState(null);
    const [loading, setLoading] = useState(true);

    // Fetch projects on mount
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

    // Fetch data when project changes
    useEffect(() => {
        if (selectedProjectId) {
            setLoading(true);
            getCashFlowForecast(selectedProjectId)
                .then((response) => {
                    // The response is now an array: [{ date, actual_income, ... }, ...]
                    const chartData = response.map(item => {
                        const totalIncome = (item.actual_income || 0) + (item.planned_income || 0);

                        // Calculate Total Expense
                        // Assuming expense values in DB are typically negative but might be positive in JSON depending on backend.
                        // Based on user snippet: "actual_expense": 500, "net_flow": -500. 
                        // This means expense is reported as POSITIVE magnitude.
                        const totalExpense = (item.actual_expense || 0) + (item.planned_expense || 0);

                        return {
                            ...item,
                            name: item.date,
                            // For Chart Scaffolding
                            Income: totalIncome,
                            Expense: totalExpense, // Render as positive bar
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

    if (loading && !selectedProjectId) return <div className="p-4">Loading Projects...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">Cash Flow Dashboard</h1>

                <select
                    className="block w-48 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md border"
                    value={selectedProjectId || ''}
                    onChange={(e) => setSelectedProjectId(Number(e.target.value))}
                >
                    {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
            </div>

            {/* Chart Section */}
            <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-lg font-medium mb-4">Cash Flow Forecast</h2>
                <div className="h-96 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip formatter={(value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }).format(value)} />
                            <Legend />
                            <ReferenceLine y={0} stroke="#000" />
                            {/* Stack 1: Income (Green) */}
                            <Bar dataKey="Income" fill="#4ade80" barSize={30} name="Income" />
                            {/* Stack 2: Expense (Red) */}
                            <Bar dataKey="Expense" fill="#f87171" barSize={30} name="Expense" />

                            <Line type="monotone" dataKey="Balance" stroke="#3b82f6" strokeWidth={3} dot={true} name="Cumulative Balance" />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Data Table Section */}
            <div className="bg-white shadow overflow-hidden rounded-lg">
                <div className="px-4 py-5 sm:px-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">Detailed Breakdown</h3>
                </div>
                <div className="border-t border-gray-200">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Act. Income</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Plan. Income</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-green-700 uppercase tracking-wider bg-green-50">Total Income</th>

                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Act. Expense</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Plan. Expense</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-red-700 uppercase tracking-wider bg-red-50">Total Expense</th>

                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-900 uppercase tracking-wider">Net Flow</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-blue-700 uppercase tracking-wider">Balance</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200 text-sm">
                                {data.map((row) => (
                                    <tr key={row.name} className="hover:bg-gray-50">
                                        <td className="px-4 py-4 whitespace-nowrap font-medium text-gray-900">{row.date}</td>

                                        {/* Income Group */}
                                        <td className="px-4 py-4 whitespace-nowrap text-right text-gray-600">
                                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }).format(row.actual_income)}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-right text-gray-600">
                                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }).format(row.planned_income)}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-right font-medium text-green-600 bg-green-50">
                                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }).format(row.Income)}
                                        </td>

                                        {/* Expense Group */}
                                        <td className="px-4 py-4 whitespace-nowrap text-right text-gray-600">
                                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }).format(row.actual_expense)}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-right text-gray-600">
                                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }).format(row.planned_expense)}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-right font-medium text-red-600 bg-red-50">
                                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }).format(row.Expense)}
                                        </td>

                                        {/* Totals */}
                                        <td className={`px-4 py-4 whitespace-nowrap text-right font-bold ${row.Net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }).format(row.Net)}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-right font-bold text-blue-700">
                                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }).format(row.Balance)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
