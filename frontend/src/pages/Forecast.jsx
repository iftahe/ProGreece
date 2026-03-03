import React, { useEffect, useState } from 'react';
import { getCompanyForecast, getProjectsForecast } from '../api';
import { AlertIcon, CalendarPlanIcon, PortfolioIcon } from '../components/Icons';
import { cn, formatEUR } from '../lib/utils';

const Forecast = () => {
    const [companyForecast, setCompanyForecast] = useState([]);
    const [companyLoading, setCompanyLoading] = useState(true);
    const [companyError, setCompanyError] = useState(null);

    const [projectsForecast, setProjectsForecast] = useState([]);
    const [projectsLoading, setProjectsLoading] = useState(true);
    const [projectsError, setProjectsError] = useState(null);

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
                    <h2 className="text-lg font-semibold text-gray-900">{'Company Cash Flow Forecast (12 Months)'}</h2>
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
                                        <td className="px-4 py-3 whitespace-nowrap text-right text-emerald-600 font-medium amount bg-emerald-50/30">
                                            {formatEUR(row.inflows || 0)}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-right text-rose-600 font-medium amount bg-rose-50/30">
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
        </div>
    );
};

export default Forecast;
