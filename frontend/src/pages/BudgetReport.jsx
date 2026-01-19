import React, { useState, useEffect } from 'react';
import { getBudgetReport, updateBudgetCategory, getProjects } from '../api';

const BudgetReport = () => {
    const [projects, setProjects] = useState([]);
    const [selectedProjectId, setSelectedProjectId] = useState(null);
    const [reportData, setReportData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editValue, setEditValue] = useState('');
    const [message, setMessage] = useState(null);

    // Fetch projects on mount
    useEffect(() => {
        getProjects().then((projs) => {
            setProjects(projs);
            if (projs.length > 0) {
                setSelectedProjectId(projs[0].id);
            }
        });
    }, []);

    // Fetch report data when project changes
    useEffect(() => {
        if (selectedProjectId) {
            loadReportData();
        }
    }, [selectedProjectId]);

    const loadReportData = async () => {
        if (!selectedProjectId) return;
        
        setLoading(true);
        setMessage(null);
        try {
            const data = await getBudgetReport(selectedProjectId);
            setReportData(data);
        } catch (error) {
            console.error("Failed to load budget report", error);
            setMessage({ type: 'error', text: 'Failed to load budget report' });
        } finally {
            setLoading(false);
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

        setLoading(true);
        setMessage(null);
        
        try {
            await updateBudgetCategory(itemId, newAmount);
            setEditingId(null);
            setEditValue('');
            
            // Re-fetch the report data to update totals, variances, and progress bars
            await loadReportData();
            
            setMessage({ type: 'success', text: 'Budget amount updated successfully' });
        } catch (error) {
            console.error("Failed to update budget category", error);
            setMessage({ type: 'error', text: 'Failed to update budget amount' });
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value);
    };

    const formatNumber = (value) => {
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value);
    };

    return (
        <div className="max-w-7xl mx-auto bg-white p-8 rounded-lg shadow space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">Budget Report</h2>
                
                {projects.length > 0 && (
                    <select
                        value={selectedProjectId || ''}
                        onChange={(e) => setSelectedProjectId(parseInt(e.target.value))}
                        className="border-gray-300 rounded-md shadow-sm border p-2"
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
                <div className={`p-4 rounded ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {message.text}
                </div>
            )}

            {loading && !reportData.length && (
                <div className="text-center py-8 text-gray-500">Loading budget report...</div>
            )}

            {!loading && reportData.length === 0 && selectedProjectId && (
                <div className="text-center py-8 text-gray-500">No budget data available for this project.</div>
            )}

            {reportData.length > 0 && (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Category
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Budget (Planned)
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Actual
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Variance
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Progress
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {reportData.map((item) => (
                                <tr
                                    key={item.id}
                                    className={`hover:bg-gray-50 ${item.is_parent ? 'bg-gray-100 font-semibold' : ''}`}
                                >
                                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${item.is_parent ? 'text-gray-900 font-bold' : 'text-gray-700'}`}>
                                        {item.is_parent ? item.name : `  ${item.name}`}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                        {editingId === item.id ? (
                                            <div className="flex items-center justify-end gap-2">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    className="w-32 border-gray-300 rounded-md shadow-sm border p-1 text-right"
                                                    autoFocus
                                                />
                                                <button
                                                    onClick={() => handleSaveEdit(item.id)}
                                                    className="text-green-600 hover:text-green-800"
                                                    title="Save"
                                                    disabled={loading}
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={handleCancelEdit}
                                                    className="text-red-600 hover:text-red-800"
                                                    title="Cancel"
                                                    disabled={loading}
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-end gap-2">
                                                <span>{formatCurrency(item.planned)}</span>
                                                <button
                                                    onClick={() => handleEditClick(item)}
                                                    className="text-gray-400 hover:text-gray-600"
                                                    title="Edit"
                                                    disabled={loading}
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                        {formatCurrency(item.actual)}
                                    </td>
                                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${
                                        item.variance >= 0 ? 'text-green-600' : 'text-red-600'
                                    }`}>
                                        {item.variance >= 0 ? '+' : ''}{formatCurrency(item.variance)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 bg-gray-200 rounded-full h-2.5">
                                                <div
                                                    className={`h-2.5 rounded-full ${
                                                        item.progress <= 100 ? 'bg-blue-600' : 'bg-red-600'
                                                    }`}
                                                    style={{ width: `${Math.min(item.progress, 100)}%` }}
                                                />
                                            </div>
                                            <span className="text-xs text-gray-600 w-12 text-right">
                                                {formatNumber(item.progress)}%
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default BudgetReport;
