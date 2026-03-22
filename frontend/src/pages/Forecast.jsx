import React, { useEffect, useState } from 'react';
import { getCompanyForecast, getProjectsForecast, getForecastDrilldown } from '../api';
import { AlertIcon, CalendarPlanIcon, PortfolioIcon } from '../components/Icons';
import { cn, formatEUR } from '../lib/utils';

// Status badge helper
const StatusBadge = ({ status }) => {
    if (status === 'executed') {
        return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                Executed
            </span>
        );
    }
    if (status === 'planned') {
        return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
                Planned
            </span>
        );
    }
    if (status === 'expected') {
        return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                Expected
            </span>
        );
    }
    return <span className="text-xs text-gray-500">{status}</span>;
};

// Drilldown items table section
const DrilldownSection = ({ title, items, total, colorClass }) => (
    <div className="mb-6">
        <h3 className={cn("text-sm font-semibold uppercase tracking-wider mb-2", colorClass)}>
            {title}
        </h3>
        {items.length === 0 ? (
            <p className="text-sm text-gray-400 italic py-2">No items</p>
        ) : (
            <div className="overflow-x-auto">
                <table className="min-w-full text-sm divide-y divide-gray-200">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Counterparty</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reference</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {items.map((item, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                                <td className="px-3 py-2 whitespace-nowrap text-gray-700">{item.date}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-gray-700">{item.category}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-gray-700">{item.counterparty}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-right font-mono font-medium text-gray-900">
                                    {formatEUR(item.amount)}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-center">
                                    <StatusBadge status={item.status} />
                                </td>
                                <td className="px-3 py-2 text-gray-500 max-w-xs truncate">{item.reference}</td>
                            </tr>
                        ))}
                        {/* Totals row */}
                        <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                            <td colSpan={3} className="px-3 py-2 text-gray-700">Total</td>
                            <td className={cn("px-3 py-2 text-right font-mono amount", colorClass)}>
                                {formatEUR(total)}
                            </td>
                            <td colSpan={2} />
                        </tr>
                    </tbody>
                </table>
            </div>
        )}
    </div>
);

// Drilldown modal
const DrilldownModal = ({ data, loading, onClose, projects, onProjectChange, selectedProjectId }) => {
    if (!data && !loading) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
                {/* Modal header */}
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <h2 className="text-lg font-semibold text-gray-900">
                            Forecast Details — {data?.month || ''}
                        </h2>
                        {projects && projects.length > 1 && (
                            <select
                                className="border border-gray-300 rounded-md text-sm px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                value={selectedProjectId || ''}
                                onChange={(e) => onProjectChange(Number(e.target.value))}
                            >
                                {projects.map(p => (
                                    <option key={p.project_id} value={p.project_id}>
                                        {p.project_name}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                        aria-label="Close"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Modal body */}
                <div className="overflow-y-auto flex-1 px-6 py-4">
                    {loading ? (
                        <div className="space-y-3 py-4">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="skeleton h-8 w-full rounded" />
                            ))}
                        </div>
                    ) : data ? (
                        <>
                            <DrilldownSection
                                title="Inflows"
                                items={data.inflow_items}
                                total={data.inflow_total}
                                colorClass="text-emerald-700"
                            />
                            <DrilldownSection
                                title="Outflows"
                                items={data.outflow_items}
                                total={data.outflow_total}
                                colorClass="text-rose-700"
                            />
                            {/* Net summary */}
                            <div className="border-t border-gray-200 pt-3 flex justify-end gap-8 text-sm font-semibold">
                                <span className="text-gray-600">Net:</span>
                                <span className={cn(
                                    "font-mono",
                                    (data.inflow_total - data.outflow_total) >= 0 ? 'text-emerald-700' : 'text-rose-700'
                                )}>
                                    {(data.inflow_total - data.outflow_total) >= 0 ? '+' : ''}
                                    {formatEUR(data.inflow_total - data.outflow_total)}
                                </span>
                            </div>
                        </>
                    ) : null}
                </div>

                {/* Modal footer */}
                <div className="px-6 py-3 border-t border-gray-100 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

const Forecast = () => {
    const [companyForecast, setCompanyForecast] = useState([]);
    const [companyLoading, setCompanyLoading] = useState(true);
    const [companyError, setCompanyError] = useState(null);

    const [projectsForecast, setProjectsForecast] = useState([]);
    const [projectsLoading, setProjectsLoading] = useState(true);
    const [projectsError, setProjectsError] = useState(null);

    // Drilldown state
    const [drilldownData, setDrilldownData] = useState(null);
    const [drilldownLoading, setDrilldownLoading] = useState(false);
    const [drilldownMonth, setDrilldownMonth] = useState(null);
    const [drilldownProjectId, setDrilldownProjectId] = useState(null);

    useEffect(() => {
        getCompanyForecast()
            .then(response => setCompanyForecast(response.data?.months || []))
            .catch(err => {
                console.error("Failed to load company forecast", err);
                setCompanyError("Failed to load company forecast data.");
            })
            .finally(() => setCompanyLoading(false));
    }, []);

    useEffect(() => {
        getProjectsForecast()
            .then(response => setProjectsForecast(response.data?.projects || []))
            .catch(err => {
                console.error("Failed to load projects forecast", err);
                setProjectsError("Failed to load project forecast data.");
            })
            .finally(() => setProjectsLoading(false));
    }, []);

    const handleMonthClick = async (projectId, month) => {
        setDrilldownMonth(month);
        setDrilldownProjectId(projectId);
        setDrilldownData(null);
        setDrilldownLoading(true);
        try {
            const data = await getForecastDrilldown(projectId, month);
            setDrilldownData(data);
        } catch (err) {
            console.error('Failed to load drilldown', err);
        } finally {
            setDrilldownLoading(false);
        }
    };

    const handleProjectChange = async (newProjectId) => {
        setDrilldownProjectId(newProjectId);
        setDrilldownData(null);
        setDrilldownLoading(true);
        try {
            const data = await getForecastDrilldown(newProjectId, drilldownMonth);
            setDrilldownData(data);
        } catch (err) {
            console.error('Failed to load drilldown', err);
        } finally {
            setDrilldownLoading(false);
        }
    };

    const handleCloseDrilldown = () => {
        setDrilldownData(null);
        setDrilldownMonth(null);
        setDrilldownProjectId(null);
    };

    // Determine default project for company forecast row clicks
    const defaultProjectId = projectsForecast.length > 0 ? projectsForecast[0].project_id : null;

    // Compute totals row for company forecast
    const companyTotals = companyForecast.reduce(
        (acc, row) => ({
            inflows: acc.inflows + (row.inflows || 0),
            outflows: acc.outflows + (row.outflows || 0),
            net: acc.net + (row.net || 0),
        }),
        { inflows: 0, outflows: 0, net: 0 }
    );

    return (
        <div className="space-y-8">
            {/* Page Header */}
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">{'Forecast'}</h1>
            </div>

            {/* Section 1: Company Cash Flow Forecast */}
            <div className="card-elevated overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                    <div className="rounded-lg p-2.5 bg-blue-50">
                        <CalendarPlanIcon className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">{'Company Cash Flow Forecast (12 Months)'}</h2>
                        <p className="text-xs text-gray-500 mt-0.5">Click Inflows or Outflows to see item breakdown</p>
                    </div>
                </div>

                {companyLoading ? (
                    <div className="p-6 space-y-3">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="skeleton h-10 w-full rounded" />
                        ))}
                    </div>
                ) : companyError ? (
                    <div className="p-6 flex items-center gap-3 text-rose-600">
                        <AlertIcon className="w-5 h-5 flex-shrink-0" />
                        <p className="text-sm">{companyError}</p>
                    </div>
                ) : companyForecast.length === 0 ? (
                    <p className="text-gray-400 text-sm text-center py-12">{'No forecast data available'}</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{'Month'}</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-emerald-700 uppercase tracking-wider bg-emerald-50/50">{'Inflows'}</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-rose-700 uppercase tracking-wider bg-rose-50/50">{'Outflows'}</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">{'Net'}</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-primary-700 uppercase tracking-wider">{'Cumulative Cash'}</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{'Alert'}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm">
                                {companyForecast.map((row, index) => (
                                    <tr
                                        key={row.month || index}
                                        className={cn(
                                            "hover:bg-gray-50",
                                            row.cash_buffer_alert ? "bg-rose-50" : (index % 2 !== 0 ? "bg-slate-50/50" : "")
                                        )}
                                    >
                                        <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">{row.month}</td>
                                        <td
                                            className="px-4 py-3 whitespace-nowrap text-right text-emerald-600 font-medium amount bg-emerald-50/30 cursor-pointer hover:bg-emerald-100 hover:underline transition-colors"
                                            onClick={() => defaultProjectId && handleMonthClick(defaultProjectId, row.month)}
                                            title="Click to see breakdown"
                                        >
                                            {formatEUR(row.inflows || 0)}
                                        </td>
                                        <td
                                            className="px-4 py-3 whitespace-nowrap text-right text-rose-600 font-medium amount bg-rose-50/30 cursor-pointer hover:bg-rose-100 hover:underline transition-colors"
                                            onClick={() => defaultProjectId && handleMonthClick(defaultProjectId, row.month)}
                                            title="Click to see breakdown"
                                        >
                                            {formatEUR(row.outflows || 0)}
                                        </td>
                                        <td className={cn(
                                            "px-4 py-3 whitespace-nowrap text-right font-bold amount",
                                            (row.net || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'
                                        )}>
                                            {(row.net || 0) >= 0 ? '+' : ''}{formatEUR(row.net || 0)}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-right font-bold text-primary-700 amount">
                                            {formatEUR(row.cumulative_cash || 0)}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-center">
                                            {row.cash_buffer_alert ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-700">
                                                    <AlertIcon className="w-3.5 h-3.5" />
                                                    {'Low Cash'}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
                                                    {'OK'}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {/* Totals row */}
                                <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                                    <td className="px-4 py-3 text-gray-700">{'Total'}</td>
                                    <td className="px-4 py-3 text-right text-emerald-700 amount">{formatEUR(companyTotals.inflows)}</td>
                                    <td className="px-4 py-3 text-right text-rose-700 amount">{formatEUR(companyTotals.outflows)}</td>
                                    <td className={cn(
                                        "px-4 py-3 text-right amount",
                                        companyTotals.net >= 0 ? 'text-emerald-700' : 'text-rose-700'
                                    )}>
                                        {companyTotals.net >= 0 ? '+' : ''}{formatEUR(companyTotals.net)}
                                    </td>
                                    <td className="px-4 py-3 text-right text-primary-700 amount">
                                        {companyForecast.length > 0
                                            ? formatEUR(companyForecast[companyForecast.length - 1].cumulative_cash || 0)
                                            : formatEUR(0)}
                                    </td>
                                    <td />
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Section 2: Project Forecast Comparison */}
            <div className="card-elevated overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                    <div className="rounded-lg p-2.5 bg-primary-50">
                        <PortfolioIcon className="w-5 h-5 text-primary-600" />
                    </div>
                    <h2 className="text-lg font-semibold text-gray-900">{'Project Forecast Comparison'}</h2>
                </div>

                {projectsLoading ? (
                    <div className="p-6 space-y-3">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="skeleton h-10 w-full rounded" />
                        ))}
                    </div>
                ) : projectsError ? (
                    <div className="p-6 flex items-center gap-3 text-rose-600">
                        <AlertIcon className="w-5 h-5 flex-shrink-0" />
                        <p className="text-sm">{projectsError}</p>
                    </div>
                ) : projectsForecast.length === 0 ? (
                    <p className="text-gray-400 text-sm text-center py-12">{'No project forecast data available'}</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{'Project'}</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{'3M Net'}</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{'6M Net'}</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{'12M Net'}</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{'Lowest Cash Point'}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm">
                                {projectsForecast.map((proj) => (
                                    <tr key={proj.project_id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap font-semibold text-gray-900">
                                            {proj.project_name}
                                        </td>
                                        <td className={cn(
                                            "px-6 py-4 whitespace-nowrap text-right font-bold font-mono",
                                            (proj.net_3m || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'
                                        )}>
                                            {(proj.net_3m || 0) >= 0 ? '+' : ''}{formatEUR(proj.net_3m || 0)}
                                        </td>
                                        <td className={cn(
                                            "px-6 py-4 whitespace-nowrap text-right font-bold font-mono",
                                            (proj.net_6m || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'
                                        )}>
                                            {(proj.net_6m || 0) >= 0 ? '+' : ''}{formatEUR(proj.net_6m || 0)}
                                        </td>
                                        <td className={cn(
                                            "px-6 py-4 whitespace-nowrap text-right font-bold font-mono",
                                            (proj.net_12m || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'
                                        )}>
                                            {(proj.net_12m || 0) >= 0 ? '+' : ''}{formatEUR(proj.net_12m || 0)}
                                        </td>
                                        <td className={cn(
                                            "px-6 py-4 whitespace-nowrap text-right font-mono",
                                            (proj.lowest_cash_point || 0) >= 0 ? 'text-gray-700' : 'text-rose-600 font-bold'
                                        )}>
                                            {formatEUR(proj.lowest_cash_point || 0)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Drilldown Modal */}
            {(drilldownData || drilldownLoading) && (
                <DrilldownModal
                    data={drilldownData}
                    loading={drilldownLoading}
                    onClose={handleCloseDrilldown}
                    projects={projectsForecast}
                    onProjectChange={handleProjectChange}
                    selectedProjectId={drilldownProjectId}
                />
            )}
        </div>
    );
};

export default Forecast;
