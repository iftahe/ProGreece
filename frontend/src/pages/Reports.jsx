import React, { useState, useEffect, useCallback } from 'react';
import {
    getInvoiceReport,
    getPnlReport,
    getPlanVsActualReport,
    getCustomerTransactionsReport,
    getCustomerBalanceReport,
    getVatReport,
    getWithholdingReport,
    getPaymentsByProjectReport,
    getProjects,
    getCustomers,
    downloadReportExcel,
} from '../api';
import { cn, formatEUR } from '../lib/utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TABS = [
    { id: 'pnl',                label: 'P&L' },
    { id: 'plan-vs-actual',     label: 'Plan vs Actual' },
    { id: 'invoices',           label: 'Invoice Details' },
    { id: 'customer-tx',        label: 'Customer Transactions' },
    { id: 'customer-balance',   label: 'Customer Balance' },
    { id: 'vat',                label: 'VAT Report' },
    { id: 'withholding',        label: 'Withholding Tax' },
    { id: 'payments-by-project', label: 'Payments by Project' },
];

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const fmt = (v) =>
    v == null
        ? '-'
        : Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtPct = (v) =>
    v == null ? '-' : `${Number(v).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const SkeletonTable = () => (
    <div className="space-y-3 mt-4">
        {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton h-10 w-full rounded" />
        ))}
    </div>
);

const EmptyState = ({ message }) => (
    <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-gray-400 text-sm">{message}</p>
    </div>
);

const ErrorBanner = ({ message }) => (
    <div className="p-3 rounded-lg text-sm font-medium bg-rose-50 text-rose-700 border border-rose-200">
        {message}
    </div>
);

const ExportButton = ({ onClick, loading }) => (
    <div className="flex justify-end">
        <button
            onClick={onClick}
            disabled={loading}
            className={cn(
                "inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors",
                loading && "opacity-50 cursor-not-allowed"
            )}
        >
            {loading ? 'Exporting...' : 'Export to Excel'}
        </button>
    </div>
);

const RunButton = ({ loading, onClick }) => (
    <button
        onClick={onClick}
        disabled={loading}
        className={cn(
            'px-5 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm transition-colors',
            loading && 'opacity-50 cursor-not-allowed'
        )}
    >
        {loading ? 'Running...' : 'Run Report'}
    </button>
);

/** Standard filter bar shell */
const FilterBar = ({ children, onRun, loading }) => (
    <div className="bg-slate-50 border border-gray-200 rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Filters</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {children}
        </div>
        <div className="flex justify-end mt-3">
            <RunButton loading={loading} onClick={onRun} />
        </div>
    </div>
);

/** A single labelled filter field wrapper */
const FilterField = ({ label, children }) => (
    <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
        {children}
    </div>
);

/** Project select shared across tabs */
const ProjectSelect = ({ value, onChange, projects }) => (
    <FilterField label="Project">
        <select name="project_id" value={value} onChange={onChange} className="input-field text-sm">
            <option value="">All Projects</option>
            {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
            ))}
        </select>
    </FilterField>
);

/** Customer select shared across tabs */
const CustomerSelect = ({ value, onChange, customers }) => (
    <FilterField label="Customer">
        <select name="customer_id" value={value} onChange={onChange} className="input-field text-sm">
            <option value="">All Customers</option>
            {customers.map(c => (
                <option key={c.id} value={c.id}>{c.full_name}</option>
            ))}
        </select>
    </FilterField>
);

/** Date range pair */
const DateRangeFields = ({ dateFrom, dateTo, onChange }) => (
    <>
        <FilterField label="Date From">
            <input
                type="date"
                name="date_from"
                value={dateFrom}
                onChange={onChange}
                className="input-field text-sm"
            />
        </FilterField>
        <FilterField label="Date To">
            <input
                type="date"
                name="date_to"
                value={dateTo}
                onChange={onChange}
                className="input-field text-sm"
            />
        </FilterField>
    </>
);

/** Table head cell helpers */
const Th = ({ children, right }) => (
    <th className={cn(
        'px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider',
        right ? 'text-right' : 'text-left'
    )}>
        {children}
    </th>
);

/** Body row cell */
const Td = ({ children, right, bold, className: extra }) => (
    <td className={cn(
        'px-4 py-3 whitespace-nowrap text-sm',
        right ? 'text-right' : 'text-left',
        bold ? 'font-bold' : '',
        extra || ''
    )}>
        {children}
    </td>
);

/** Foot total cell */
const TdTotal = ({ children, right, className: extra }) => (
    <td className={cn(
        'px-4 py-3 text-sm font-bold',
        right ? 'text-right' : 'text-left',
        extra || ''
    )}>
        {children}
    </td>
);

// ---------------------------------------------------------------------------
// Drill-down modal (Phase 6 placeholder)
// ---------------------------------------------------------------------------

const DrillDownModal = ({ label, onClose }) => (
    <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        onClick={onClose}
    >
        <div
            className="bg-white rounded-xl shadow-xl p-8 max-w-md w-full mx-4"
            onClick={e => e.stopPropagation()}
        >
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Drill-Down</h2>
            <p className="text-sm text-gray-600 mb-6">Drill-down for: <span className="font-medium text-gray-800">{label}</span></p>
            <p className="text-xs text-gray-400 mb-6">Detailed transaction view will be available in Phase 6.</p>
            <div className="flex justify-end">
                <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
                >
                    Close
                </button>
            </div>
        </div>
    </div>
);

// ---------------------------------------------------------------------------
// useReportState — generic hook shared by all tabs
// ---------------------------------------------------------------------------

function useReportState() {
    const [data, setData]       = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState(null);
    const [hasRun, setHasRun]   = useState(false);

    const run = useCallback(async (apiFn, params) => {
        setLoading(true);
        setError(null);
        try {
            const result = await apiFn(params);
            setData(result);
            setHasRun(true);
        } catch (e) {
            console.error(e);
            setError(e?.response?.data?.detail || 'Failed to load report');
        } finally {
            setLoading(false);
        }
    }, []);

    return { data, loading, error, hasRun, run };
}

// ---------------------------------------------------------------------------
// Tab 1 — P&L
// ---------------------------------------------------------------------------

function PnlTab({ projects }) {
    const [filters, setFilters] = useState({ project_id: '', date_from: '', date_to: '' });
    const { data, loading, error, hasRun, run } = useReportState();
    const [drillDown, setDrillDown] = useState(null);
    const [exporting, setExporting] = useState(false);

    const onChange = e => setFilters(p => ({ ...p, [e.target.name]: e.target.value }));

    const handleRun = () => {
        const params = {};
        if (filters.project_id) params.project_id = filters.project_id;
        if (filters.date_from)  params.date_from  = filters.date_from;
        if (filters.date_to)    params.date_to    = filters.date_to;
        run(getPnlReport, params);
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            const params = {};
            if (filters.project_id) params.project_id = filters.project_id;
            if (filters.date_from)  params.date_from  = filters.date_from;
            if (filters.date_to)    params.date_to    = filters.date_to;
            await downloadReportExcel('/reports/pnl', params, 'pnl-report.xlsx');
        } catch (e) {
            console.error('Export failed', e);
        } finally {
            setExporting(false);
        }
    };

    const rows   = data?.rows   || data || [];
    const totals = data?.totals || null;

    const renderPnlRow = (row, i) => {
        const rt = row.row_type;

        if (rt === 'section_header') {
            const isIncome = row.section === 'income';
            const bgClass = isIncome
                ? 'bg-blue-600 text-white'
                : 'bg-rose-600 text-white';
            return (
                <tr key={i} className={bgClass}>
                    <td colSpan={7} className="px-4 py-2 text-sm font-bold uppercase tracking-wider">
                        {isIncome ? 'INCOME' : 'EXPENSES'}
                    </td>
                </tr>
            );
        }

        if (rt === 'subtotal') {
            return (
                <tr key={i} className="bg-gray-100 border-t border-gray-300">
                    <td className="px-4 py-2 text-sm font-semibold text-gray-700 pl-6">{row.category}</td>
                    <td className="px-4 py-2 text-sm text-gray-500"></td>
                    <td className="px-4 py-2 text-sm font-semibold text-right text-gray-800">{fmt(row.trans_value)}</td>
                    <td className="px-4 py-2 text-sm font-semibold text-right text-gray-800">{fmt(row.vat_value)}</td>
                    <td className="px-4 py-2 text-sm font-semibold text-right text-gray-800">{fmt(row.value_no_vat)}</td>
                    <td className="px-4 py-2 text-sm font-semibold text-right text-gray-800">{fmt(row.withholding_value)}</td>
                    <td className="px-4 py-2 text-sm font-semibold text-right text-gray-800">{fmt(row.value_no_vat_no_withholding)}</td>
                </tr>
            );
        }

        if (rt === 'total') {
            const isIncome = row.section === 'income';
            const bgClass = isIncome ? 'bg-blue-100 border-t-2 border-blue-300' : 'bg-rose-100 border-t-2 border-rose-300';
            const textClass = isIncome ? 'text-blue-900' : 'text-rose-900';
            return (
                <tr key={i} className={bgClass}>
                    <td className={cn('px-4 py-2 text-sm font-bold', textClass)} colSpan={2}>{row.category}</td>
                    <td className={cn('px-4 py-2 text-sm font-bold text-right', textClass)}>{fmt(row.trans_value)}</td>
                    <td className={cn('px-4 py-2 text-sm font-bold text-right', textClass)}>{fmt(row.vat_value)}</td>
                    <td className={cn('px-4 py-2 text-sm font-bold text-right', textClass)}>{fmt(row.value_no_vat)}</td>
                    <td className={cn('px-4 py-2 text-sm font-bold text-right', textClass)}>{fmt(row.withholding_value)}</td>
                    <td className={cn('px-4 py-2 text-sm font-bold text-right', textClass)}>{fmt(row.value_no_vat_no_withholding)}</td>
                </tr>
            );
        }

        if (rt === 'grand_total') {
            const isPositive = (row.trans_value || 0) >= 0;
            const textClass = isPositive ? 'text-green-900' : 'text-red-900';
            return (
                <tr key={i} className="bg-yellow-100 border-t-4 border-yellow-400">
                    <td className={cn('px-4 py-3 text-base font-bold', textClass)} colSpan={2}>{row.category}</td>
                    <td className={cn('px-4 py-3 text-base font-bold text-right', textClass)}>{fmt(row.trans_value)}</td>
                    <td className={cn('px-4 py-3 text-base font-bold text-right', textClass)}>{fmt(row.vat_value)}</td>
                    <td className={cn('px-4 py-3 text-base font-bold text-right', textClass)}>{fmt(row.value_no_vat)}</td>
                    <td className={cn('px-4 py-3 text-base font-bold text-right', textClass)}>{fmt(row.withholding_value)}</td>
                    <td className={cn('px-4 py-3 text-base font-bold text-right', textClass)}>{fmt(row.value_no_vat_no_withholding)}</td>
                </tr>
            );
        }

        // detail row
        return (
            <tr
                key={i}
                className="hover:bg-blue-50 cursor-pointer border-b border-gray-100"
                onClick={() => setDrillDown(row.category || row.counterparty || `Row ${i + 1}`)}
            >
                <td className="px-4 py-2 text-sm text-gray-700 pl-8">{row.category || '-'}</td>
                <td className="px-4 py-2 text-sm text-gray-500">{row.counterparty || '-'}</td>
                <td className="px-4 py-2 text-sm text-right text-gray-700">{fmt(row.trans_value)}</td>
                <td className="px-4 py-2 text-sm text-right text-gray-700">{fmt(row.vat_value)}</td>
                <td className="px-4 py-2 text-sm text-right text-gray-700">{fmt(row.value_no_vat)}</td>
                <td className="px-4 py-2 text-sm text-right text-gray-700">{fmt(row.withholding_value)}</td>
                <td className="px-4 py-2 text-sm text-right font-medium text-gray-800">{fmt(row.value_no_vat_no_withholding)}</td>
            </tr>
        );
    };

    return (
        <div className="space-y-5">
            {drillDown && <DrillDownModal label={drillDown} onClose={() => setDrillDown(null)} />}

            <FilterBar onRun={handleRun} loading={loading}>
                <ProjectSelect value={filters.project_id} onChange={onChange} projects={projects} />
                <DateRangeFields dateFrom={filters.date_from} dateTo={filters.date_to} onChange={onChange} />
            </FilterBar>

            {error && <ErrorBanner message={error} />}
            {loading && <SkeletonTable />}

            {!loading && hasRun && (
                <>
                    {rows.length === 0 ? (
                        <EmptyState message="No P&L data found for the selected filters." />
                    ) : (
                        <div className="overflow-x-auto rounded-lg border border-gray-200">
                            <table className="min-w-full">
                                <thead className="bg-slate-50 border-b border-gray-200">
                                    <tr>
                                        <Th>Category</Th>
                                        <Th>Counterparty</Th>
                                        <Th right>Trans Value</Th>
                                        <Th right>VAT Value</Th>
                                        <Th right>Value No VAT</Th>
                                        <Th right>Withholding Value</Th>
                                        <Th right>Value No VAT No Withholding</Th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white">
                                    {rows.map((row, i) => renderPnlRow(row, i))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {rows.length > 0 && <ExportButton onClick={handleExport} loading={exporting} />}
                </>
            )}

            {!loading && !hasRun && (
                <EmptyState message="Set filters above and click Run Report to view the P&L report." />
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Tab 2 — Plan vs Actual
// ---------------------------------------------------------------------------

function PlanVsActualTab({ projects }) {
    const [filters, setFilters] = useState({ project_id: '', date_from: '', date_to: '' });
    const { data, loading, error, hasRun, run } = useReportState();
    const [drillDown, setDrillDown] = useState(null);
    const [exporting, setExporting] = useState(false);

    const onChange = e => setFilters(p => ({ ...p, [e.target.name]: e.target.value }));

    const handleRun = () => {
        const params = {};
        if (filters.project_id) params.project_id = filters.project_id;
        if (filters.date_from)  params.date_from  = filters.date_from;
        if (filters.date_to)    params.date_to    = filters.date_to;
        run(getPlanVsActualReport, params);
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            const params = {};
            if (filters.project_id) params.project_id = filters.project_id;
            if (filters.date_from)  params.date_from  = filters.date_from;
            if (filters.date_to)    params.date_to    = filters.date_to;
            await downloadReportExcel('/reports/plan-vs-actual', params, 'plan-vs-actual.xlsx');
        } catch (e) {
            console.error('Export failed', e);
        } finally {
            setExporting(false);
        }
    };

    const rows   = data?.rows   || data || [];
    const totals = data?.totals || null;

    return (
        <div className="space-y-5">
            {drillDown && <DrillDownModal label={drillDown} onClose={() => setDrillDown(null)} />}

            <FilterBar onRun={handleRun} loading={loading}>
                <ProjectSelect value={filters.project_id} onChange={onChange} projects={projects} />
                <DateRangeFields dateFrom={filters.date_from} dateTo={filters.date_to} onChange={onChange} />
            </FilterBar>

            {error && <ErrorBanner message={error} />}
            {loading && <SkeletonTable />}

            {!loading && hasRun && (
                <>
                    {rows.length === 0 ? (
                        <EmptyState message="No plan vs actual data found for the selected filters." />
                    ) : (
                        <div className="overflow-x-auto rounded-lg border border-gray-200">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <Th>Category</Th>
                                        <Th right>Planned</Th>
                                        <Th right>Actual</Th>
                                        <Th right>Variance</Th>
                                        <Th right>VAT Amount</Th>
                                        <Th right>Withholding</Th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-white">
                                    {rows.map((row, i) => {
                                        const variance = row.variance ?? ((row.actual || 0) - (row.planned || 0));
                                        const varClass = variance > 0 ? 'text-rose-600' : variance < 0 ? 'text-emerald-600' : 'text-gray-600';
                                        return (
                                            <tr
                                                key={i}
                                                className={cn('hover:bg-blue-50 cursor-pointer', i % 2 !== 0 && 'bg-slate-50/50')}
                                                onClick={() => setDrillDown(row.category || `Row ${i + 1}`)}
                                            >
                                                <Td className="font-medium text-gray-900">{row.category || '-'}</Td>
                                                <Td right>{fmt(row.planned)}</Td>
                                                <Td right>{fmt(row.actual)}</Td>
                                                <Td right className={varClass}>{fmt(variance)}</Td>
                                                <Td right>{fmt(row.vat_amount)}</Td>
                                                <Td right>{fmt(row.withholding)}</Td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot className="bg-slate-100 border-t-2 border-gray-300">
                                    <tr>
                                        <TdTotal>Total ({rows.length} row{rows.length !== 1 ? 's' : ''})</TdTotal>
                                        <TdTotal right>{fmt(totals?.total_planned    ?? rows.reduce((s, r) => s + (r.planned    || 0), 0))}</TdTotal>
                                        <TdTotal right>{fmt(totals?.total_actual     ?? rows.reduce((s, r) => s + (r.actual     || 0), 0))}</TdTotal>
                                        <TdTotal right>{fmt(totals?.total_variance   ?? rows.reduce((s, r) => s + (r.variance   || ((r.actual || 0) - (r.planned || 0))), 0))}</TdTotal>
                                        <TdTotal right>{fmt(totals?.total_vat_amount ?? rows.reduce((s, r) => s + (r.vat_amount || 0), 0))}</TdTotal>
                                        <TdTotal right>{fmt(totals?.total_withholding ?? rows.reduce((s, r) => s + (r.withholding || 0), 0))}</TdTotal>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                    {rows.length > 0 && <ExportButton onClick={handleExport} loading={exporting} />}
                </>
            )}

            {!loading && !hasRun && (
                <EmptyState message="Set filters above and click Run Report to view plan vs actual data." />
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Tab 3 — Invoice Details (original implementation, preserved)
// ---------------------------------------------------------------------------

function InvoiceDetailsTab({ projects, customers }) {
    const [filters, setFilters] = useState({ project_id: '', customer_id: '', date_from: '', date_to: '' });
    const { data, loading, error, hasRun, run } = useReportState();
    const [exporting, setExporting] = useState(false);

    const onChange = e => setFilters(p => ({ ...p, [e.target.name]: e.target.value }));

    const handleRun = () => {
        const params = {};
        if (filters.project_id)  params.project_id  = filters.project_id;
        if (filters.customer_id) params.customer_id = filters.customer_id;
        if (filters.date_from)   params.date_from   = filters.date_from;
        if (filters.date_to)     params.date_to     = filters.date_to;
        run(getInvoiceReport, params);
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            const params = {};
            if (filters.project_id)  params.project_id  = filters.project_id;
            if (filters.customer_id) params.customer_id = filters.customer_id;
            if (filters.date_from)   params.date_from   = filters.date_from;
            if (filters.date_to)     params.date_to     = filters.date_to;
            await downloadReportExcel('/reports/invoices', params, 'invoice-details.xlsx');
        } catch (e) {
            console.error('Export failed', e);
        } finally {
            setExporting(false);
        }
    };

    const rows   = data?.rows   || data || [];
    const totals = data?.totals || null;

    return (
        <div className="space-y-5">
            <FilterBar onRun={handleRun} loading={loading}>
                <ProjectSelect value={filters.project_id} onChange={onChange} projects={projects} />
                <CustomerSelect value={filters.customer_id} onChange={onChange} customers={customers} />
                <DateRangeFields dateFrom={filters.date_from} dateTo={filters.date_to} onChange={onChange} />
            </FilterBar>

            {error && <ErrorBanner message={error} />}
            {loading && <SkeletonTable />}

            {!loading && hasRun && (
                <>
                    {rows.length === 0 ? (
                        <EmptyState message="No invoices found for this project. Import invoices from the Invoices page or create them manually." />
                    ) : (
                        <div className="overflow-x-auto rounded-lg border border-gray-200">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <Th>Invoice #</Th>
                                        <Th>Date</Th>
                                        <Th>Project</Th>
                                        <Th>Customer</Th>
                                        <Th>Counterparty</Th>
                                        <Th right>Value</Th>
                                        <Th right>Paid</Th>
                                        <Th right>Balance</Th>
                                        <Th>Remarks</Th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-white text-sm">
                                    {rows.map((row, i) => {
                                        const balance = row.balance ?? (row.invoice_value - (row.paid_amount || 0));
                                        const isPaid  = balance <= 0;
                                        return (
                                            <tr key={row.id ?? i} className={cn('hover:bg-gray-50', i % 2 !== 0 && 'bg-slate-50/50')}>
                                                <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">{row.invoice_number || '-'}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-gray-600">{row.invoice_date || '-'}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-gray-700">{row.project_name || '-'}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-gray-700">{row.customer_name || '-'}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-gray-700">{row.counterparty_name || '-'}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-right font-medium text-gray-900">
                                                    {formatEUR(row.invoice_value)}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-right text-emerald-700">
                                                    {row.paid_amount != null ? formatEUR(row.paid_amount) : '-'}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-right">
                                                    <span className={cn(
                                                        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                                                        isPaid
                                                            ? 'bg-emerald-50 text-emerald-700'
                                                            : balance < row.invoice_value
                                                                ? 'bg-amber-50 text-amber-700'
                                                                : 'bg-rose-50 text-rose-700'
                                                    )}>
                                                        {isPaid ? 'Paid' : formatEUR(balance)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{row.remarks || ''}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot className="bg-slate-100 border-t-2 border-gray-300">
                                    <tr>
                                        <td colSpan={5} className="px-4 py-3 text-sm font-semibold text-gray-700">
                                            Total ({rows.length} invoice{rows.length !== 1 ? 's' : ''})
                                        </td>
                                        <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                                            {totals?.total_value != null
                                                ? formatEUR(totals.total_value)
                                                : formatEUR(rows.reduce((s, r) => s + (r.invoice_value || 0), 0))}
                                        </td>
                                        <td className="px-4 py-3 text-right text-sm font-bold text-emerald-700">
                                            {totals?.total_paid != null
                                                ? formatEUR(totals.total_paid)
                                                : formatEUR(rows.reduce((s, r) => s + (r.paid_amount || 0), 0))}
                                        </td>
                                        <td className="px-4 py-3 text-right text-sm font-bold text-rose-700">
                                            {totals?.total_balance != null
                                                ? formatEUR(totals.total_balance)
                                                : formatEUR(rows.reduce((s, r) => {
                                                    const bal = r.balance ?? (r.invoice_value - (r.paid_amount || 0));
                                                    return s + Math.max(0, bal);
                                                }, 0))}
                                        </td>
                                        <td className="px-4 py-3" />
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                    {rows.length > 0 && <ExportButton onClick={handleExport} loading={exporting} />}
                </>
            )}

            {!loading && !hasRun && (
                <EmptyState message="Set filters above and click Run Report to view invoice details." />
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Tab 4 — Customer Transactions
// ---------------------------------------------------------------------------

function CustomerTransactionsTab({ projects, customers }) {
    const [filters, setFilters] = useState({ project_id: '', customer_id: '', date_from: '', date_to: '' });
    const { data, loading, error, hasRun, run } = useReportState();
    const [exporting, setExporting] = useState(false);

    const onChange = e => setFilters(p => ({ ...p, [e.target.name]: e.target.value }));

    const handleRun = () => {
        const params = {};
        if (filters.project_id)  params.project_id  = filters.project_id;
        if (filters.customer_id) params.customer_id = filters.customer_id;
        if (filters.date_from)   params.date_from   = filters.date_from;
        if (filters.date_to)     params.date_to     = filters.date_to;
        run(getCustomerTransactionsReport, params);
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            const params = {};
            if (filters.project_id)  params.project_id  = filters.project_id;
            if (filters.customer_id) params.customer_id = filters.customer_id;
            if (filters.date_from)   params.date_from   = filters.date_from;
            if (filters.date_to)     params.date_to     = filters.date_to;
            await downloadReportExcel('/reports/customer-transactions', params, 'customer-transactions.xlsx');
        } catch (e) {
            console.error('Export failed', e);
        } finally {
            setExporting(false);
        }
    };

    const rows   = data?.rows   || data || [];
    const totals = data?.totals || null;

    return (
        <div className="space-y-5">
            <FilterBar onRun={handleRun} loading={loading}>
                <ProjectSelect  value={filters.project_id}  onChange={onChange} projects={projects} />
                <CustomerSelect value={filters.customer_id} onChange={onChange} customers={customers} />
                <DateRangeFields dateFrom={filters.date_from} dateTo={filters.date_to} onChange={onChange} />
            </FilterBar>

            {error && <ErrorBanner message={error} />}
            {loading && <SkeletonTable />}

            {!loading && hasRun && (
                <>
                    {rows.length === 0 ? (
                        <EmptyState message="No customer transactions found for the selected filters." />
                    ) : (
                        <div className="overflow-x-auto rounded-lg border border-gray-200">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <Th>Customer</Th>
                                        <Th>Project</Th>
                                        <Th>Apartment</Th>
                                        <Th>Date</Th>
                                        <Th right>Amount</Th>
                                        <Th>Description</Th>
                                        <Th>Source Ref</Th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-white">
                                    {rows.map((row, i) => (
                                        <tr key={i} className={cn('hover:bg-gray-50', i % 2 !== 0 && 'bg-slate-50/50')}>
                                            <Td className="font-medium text-gray-900">{row.customer || row.customer_name || '-'}</Td>
                                            <Td className="text-gray-700">{row.project || row.project_name || '-'}</Td>
                                            <Td className="text-gray-700">{row.apartment || row.apartment_name || '-'}</Td>
                                            <Td className="text-gray-600">{row.date || row.transaction_date || '-'}</Td>
                                            <Td right bold className="text-gray-900">{fmt(row.amount)}</Td>
                                            <Td className="text-gray-600 max-w-xs truncate">{row.description || '-'}</Td>
                                            <Td className="text-gray-500">{row.source_ref || row.reference || '-'}</Td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-slate-100 border-t-2 border-gray-300">
                                    <tr>
                                        <TdTotal colSpan={4}>Total ({rows.length} transaction{rows.length !== 1 ? 's' : ''})</TdTotal>
                                        <TdTotal right className="text-gray-900">
                                            {fmt(totals?.total_amount ?? rows.reduce((s, r) => s + (r.amount || 0), 0))}
                                        </TdTotal>
                                        <TdTotal colSpan={2} />
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                    {rows.length > 0 && <ExportButton onClick={handleExport} loading={exporting} />}
                </>
            )}

            {!loading && !hasRun && (
                <EmptyState message="Set filters above and click Run Report to view customer transactions." />
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Tab 5 — Customer Balance
// ---------------------------------------------------------------------------

function CustomerBalanceTab({ projects, customers }) {
    const [filters, setFilters] = useState({ project_id: '', customer_id: '' });
    const { data, loading, error, hasRun, run } = useReportState();
    const [exporting, setExporting] = useState(false);

    const onChange = e => setFilters(p => ({ ...p, [e.target.name]: e.target.value }));

    const handleRun = () => {
        const params = {};
        if (filters.project_id)  params.project_id  = filters.project_id;
        if (filters.customer_id) params.customer_id = filters.customer_id;
        run(getCustomerBalanceReport, params);
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            const params = {};
            if (filters.project_id)  params.project_id  = filters.project_id;
            if (filters.customer_id) params.customer_id = filters.customer_id;
            await downloadReportExcel('/reports/customer-balance', params, 'customer-balance.xlsx');
        } catch (e) {
            console.error('Export failed', e);
        } finally {
            setExporting(false);
        }
    };

    const rows   = data?.rows   || data || [];
    const totals = data?.totals || null;

    return (
        <div className="space-y-5">
            <FilterBar onRun={handleRun} loading={loading}>
                <ProjectSelect  value={filters.project_id}  onChange={onChange} projects={projects} />
                <CustomerSelect value={filters.customer_id} onChange={onChange} customers={customers} />
            </FilterBar>

            {error && <ErrorBanner message={error} />}
            {loading && <SkeletonTable />}

            {!loading && hasRun && (
                <>
                    {rows.length === 0 ? (
                        <EmptyState message="No customer balance data found for the selected filters." />
                    ) : (
                        <div className="overflow-x-auto rounded-lg border border-gray-200">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <Th>Customer</Th>
                                        <Th>Apartment</Th>
                                        <Th right>Sale Price</Th>
                                        <Th right>Received</Th>
                                        <Th right>Remaining</Th>
                                        <Th right>% Paid</Th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-white">
                                    {rows.map((row, i) => {
                                        const remaining = row.remaining ?? ((row.sale_price || 0) - (row.received || 0));
                                        const pctPaid   = row.pct_paid ?? (row.sale_price ? (((row.received || 0) / row.sale_price) * 100) : null);
                                        const pctClass  = pctPaid >= 100 ? 'text-emerald-600' : pctPaid >= 50 ? 'text-amber-600' : 'text-rose-600';
                                        return (
                                            <tr key={i} className={cn('hover:bg-gray-50', i % 2 !== 0 && 'bg-slate-50/50')}>
                                                <Td className="font-medium text-gray-900">{row.customer || row.customer_name || '-'}</Td>
                                                <Td className="text-gray-700">{row.apartment || row.apartment_name || '-'}</Td>
                                                <Td right className="text-gray-900">{fmt(row.sale_price)}</Td>
                                                <Td right className="text-emerald-700">{fmt(row.received)}</Td>
                                                <Td right className="text-rose-700">{fmt(remaining)}</Td>
                                                <Td right className={pctClass}>{fmtPct(pctPaid)}</Td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot className="bg-slate-100 border-t-2 border-gray-300">
                                    <tr>
                                        <TdTotal colSpan={2}>Total ({rows.length} apartment{rows.length !== 1 ? 's' : ''})</TdTotal>
                                        <TdTotal right className="text-gray-900">
                                            {fmt(totals?.total_sale_price ?? rows.reduce((s, r) => s + (r.sale_price || 0), 0))}
                                        </TdTotal>
                                        <TdTotal right className="text-emerald-700">
                                            {fmt(totals?.total_received ?? rows.reduce((s, r) => s + (r.received || 0), 0))}
                                        </TdTotal>
                                        <TdTotal right className="text-rose-700">
                                            {fmt(totals?.total_remaining ?? rows.reduce((s, r) => {
                                                const rem = r.remaining ?? ((r.sale_price || 0) - (r.received || 0));
                                                return s + rem;
                                            }, 0))}
                                        </TdTotal>
                                        <TdTotal right />
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                    {rows.length > 0 && <ExportButton onClick={handleExport} loading={exporting} />}
                </>
            )}

            {!loading && !hasRun && (
                <EmptyState message="Set filters above and click Run Report to view customer balances." />
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Tab 6 — VAT Report
// ---------------------------------------------------------------------------

function VatReportTab({ projects }) {
    const [filters, setFilters] = useState({ project_id: '', date_from: '', date_to: '' });
    const { data, loading, error, hasRun, run } = useReportState();
    const [exporting, setExporting] = useState(false);

    const onChange = e => setFilters(p => ({ ...p, [e.target.name]: e.target.value }));

    const handleRun = () => {
        const params = {};
        if (filters.project_id) params.project_id = filters.project_id;
        if (filters.date_from)  params.date_from  = filters.date_from;
        if (filters.date_to)    params.date_to    = filters.date_to;
        run(getVatReport, params);
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            const params = {};
            if (filters.project_id) params.project_id = filters.project_id;
            if (filters.date_from)  params.date_from  = filters.date_from;
            if (filters.date_to)    params.date_to    = filters.date_to;
            await downloadReportExcel('/reports/vat', params, 'vat-report.xlsx');
        } catch (e) {
            console.error('Export failed', e);
        } finally {
            setExporting(false);
        }
    };

    const rows   = data?.rows   || data || [];
    const totals = data?.totals || null;

    return (
        <div className="space-y-5">
            <FilterBar onRun={handleRun} loading={loading}>
                <ProjectSelect value={filters.project_id} onChange={onChange} projects={projects} />
                <DateRangeFields dateFrom={filters.date_from} dateTo={filters.date_to} onChange={onChange} />
            </FilterBar>

            {error && <ErrorBanner message={error} />}
            {loading && <SkeletonTable />}

            {!loading && hasRun && (
                <>
                    {rows.length === 0 ? (
                        <EmptyState message="No VAT data found for the selected filters." />
                    ) : (
                        <div className="overflow-x-auto rounded-lg border border-gray-200">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <Th>Counterparty</Th>
                                        <Th>Description</Th>
                                        <Th>Date</Th>
                                        <Th right>Amount</Th>
                                        <Th right>VAT Amount</Th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-white">
                                    {rows.map((row, i) => (
                                        <tr key={i} className={cn('hover:bg-gray-50', i % 2 !== 0 && 'bg-slate-50/50')}>
                                            <Td className="font-medium text-gray-900">{row.counterparty || row.counterparty_name || '-'}</Td>
                                            <Td className="text-gray-600 max-w-xs truncate">{row.description || '-'}</Td>
                                            <Td className="text-gray-600">{row.date || row.transaction_date || '-'}</Td>
                                            <Td right className="text-gray-900">{fmt(row.amount)}</Td>
                                            <Td right bold className="text-blue-700">{fmt(row.vat_amount)}</Td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-slate-100 border-t-2 border-gray-300">
                                    <tr>
                                        <TdTotal colSpan={3}>Total ({rows.length} transaction{rows.length !== 1 ? 's' : ''})</TdTotal>
                                        <TdTotal right className="text-gray-900">
                                            {fmt(totals?.total_amount ?? rows.reduce((s, r) => s + (r.amount || 0), 0))}
                                        </TdTotal>
                                        <TdTotal right className="text-blue-700">
                                            {fmt(totals?.total_vat_amount ?? rows.reduce((s, r) => s + (r.vat_amount || 0), 0))}
                                        </TdTotal>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                    {rows.length > 0 && <ExportButton onClick={handleExport} loading={exporting} />}
                </>
            )}

            {!loading && !hasRun && (
                <EmptyState message="Set filters above and click Run Report to view VAT data." />
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Tab 7 — Withholding Tax
// ---------------------------------------------------------------------------

function WithholdingTaxTab({ projects }) {
    const [filters, setFilters] = useState({ project_id: '', date_from: '', date_to: '' });
    const { data, loading, error, hasRun, run } = useReportState();
    const [exporting, setExporting] = useState(false);

    const onChange = e => setFilters(p => ({ ...p, [e.target.name]: e.target.value }));

    const handleRun = () => {
        const params = {};
        if (filters.project_id) params.project_id = filters.project_id;
        if (filters.date_from)  params.date_from  = filters.date_from;
        if (filters.date_to)    params.date_to    = filters.date_to;
        run(getWithholdingReport, params);
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            const params = {};
            if (filters.project_id) params.project_id = filters.project_id;
            if (filters.date_from)  params.date_from  = filters.date_from;
            if (filters.date_to)    params.date_to    = filters.date_to;
            await downloadReportExcel('/reports/withholding', params, 'withholding-tax.xlsx');
        } catch (e) {
            console.error('Export failed', e);
        } finally {
            setExporting(false);
        }
    };

    const rows   = data?.rows   || data || [];
    const totals = data?.totals || null;

    return (
        <div className="space-y-5">
            <FilterBar onRun={handleRun} loading={loading}>
                <ProjectSelect value={filters.project_id} onChange={onChange} projects={projects} />
                <DateRangeFields dateFrom={filters.date_from} dateTo={filters.date_to} onChange={onChange} />
            </FilterBar>

            {error && <ErrorBanner message={error} />}
            {loading && <SkeletonTable />}

            {!loading && hasRun && (
                <>
                    {rows.length === 0 ? (
                        <EmptyState message="No withholding tax data found for the selected filters." />
                    ) : (
                        <div className="overflow-x-auto rounded-lg border border-gray-200">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <Th>Counterparty</Th>
                                        <Th>Description</Th>
                                        <Th>Date</Th>
                                        <Th right>Amount</Th>
                                        <Th right>Withholding Amount</Th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-white">
                                    {rows.map((row, i) => (
                                        <tr key={i} className={cn('hover:bg-gray-50', i % 2 !== 0 && 'bg-slate-50/50')}>
                                            <Td className="font-medium text-gray-900">{row.counterparty || row.counterparty_name || '-'}</Td>
                                            <Td className="text-gray-600 max-w-xs truncate">{row.description || '-'}</Td>
                                            <Td className="text-gray-600">{row.date || row.transaction_date || '-'}</Td>
                                            <Td right className="text-gray-900">{fmt(row.amount)}</Td>
                                            <Td right bold className="text-orange-700">{fmt(row.withholding_amount || row.withholding)}</Td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-slate-100 border-t-2 border-gray-300">
                                    <tr>
                                        <TdTotal colSpan={3}>Total ({rows.length} transaction{rows.length !== 1 ? 's' : ''})</TdTotal>
                                        <TdTotal right className="text-gray-900">
                                            {fmt(totals?.total_amount ?? rows.reduce((s, r) => s + (r.amount || 0), 0))}
                                        </TdTotal>
                                        <TdTotal right className="text-orange-700">
                                            {fmt(totals?.total_withholding ?? rows.reduce((s, r) => s + (r.withholding_amount || r.withholding || 0), 0))}
                                        </TdTotal>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                    {rows.length > 0 && <ExportButton onClick={handleExport} loading={exporting} />}
                </>
            )}

            {!loading && !hasRun && (
                <EmptyState message="Set filters above and click Run Report to view withholding tax data." />
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Tab 8 — Payments by Project
// ---------------------------------------------------------------------------

function PaymentsByProjectTab({ projects }) {
    const [filters, setFilters] = useState({ project_id: '', date_from: '', date_to: '' });
    const { data, loading, error, hasRun, run } = useReportState();
    const [exporting, setExporting] = useState(false);

    const onChange = e => setFilters(p => ({ ...p, [e.target.name]: e.target.value }));

    const handleRun = () => {
        const params = {};
        if (filters.project_id) params.project_id = filters.project_id;
        if (filters.date_from)  params.date_from  = filters.date_from;
        if (filters.date_to)    params.date_to    = filters.date_to;
        run(getPaymentsByProjectReport, params);
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            const params = {};
            if (filters.project_id) params.project_id = filters.project_id;
            if (filters.date_from)  params.date_from  = filters.date_from;
            if (filters.date_to)    params.date_to    = filters.date_to;
            await downloadReportExcel('/reports/payments-by-project', params, 'payments-by-project.xlsx');
        } catch (e) {
            console.error('Export failed', e);
        } finally {
            setExporting(false);
        }
    };

    const rows   = data?.rows   || data || [];
    const totals = data?.totals || null;

    return (
        <div className="space-y-5">
            <FilterBar onRun={handleRun} loading={loading}>
                <ProjectSelect value={filters.project_id} onChange={onChange} projects={projects} />
                <DateRangeFields dateFrom={filters.date_from} dateTo={filters.date_to} onChange={onChange} />
            </FilterBar>

            {error && <ErrorBanner message={error} />}
            {loading && <SkeletonTable />}

            {!loading && hasRun && (
                <>
                    {rows.length === 0 ? (
                        <EmptyState message="No payments data found for the selected filters." />
                    ) : (
                        <div className="overflow-x-auto rounded-lg border border-gray-200">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <Th>Project</Th>
                                        <Th>Counterparty</Th>
                                        <Th>Month</Th>
                                        <Th right>Amount</Th>
                                        <Th>Description</Th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-white">
                                    {rows.map((row, i) => (
                                        <tr key={i} className={cn('hover:bg-gray-50', i % 2 !== 0 && 'bg-slate-50/50')}>
                                            <Td className="font-medium text-gray-900">{row.project || row.project_name || '-'}</Td>
                                            <Td className="text-gray-700">{row.counterparty || row.counterparty_name || '-'}</Td>
                                            <Td className="text-gray-600">{row.month || '-'}</Td>
                                            <Td right bold className="text-gray-900">{fmt(row.amount)}</Td>
                                            <Td className="text-gray-500 max-w-xs truncate">{row.description || '-'}</Td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-slate-100 border-t-2 border-gray-300">
                                    <tr>
                                        <TdTotal colSpan={3}>Total ({rows.length} row{rows.length !== 1 ? 's' : ''})</TdTotal>
                                        <TdTotal right className="text-gray-900">
                                            {fmt(totals?.total_amount ?? rows.reduce((s, r) => s + (r.amount || 0), 0))}
                                        </TdTotal>
                                        <TdTotal />
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                    {rows.length > 0 && <ExportButton onClick={handleExport} loading={exporting} />}
                </>
            )}

            {!loading && !hasRun && (
                <EmptyState message="Set filters above and click Run Report to view payments by project." />
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Root page component
// ---------------------------------------------------------------------------

export default function Reports() {
    const [activeTab, setActiveTab] = useState('invoices');
    const [projects,  setProjects]  = useState([]);
    const [customers, setCustomers] = useState([]);

    useEffect(() => {
        Promise.all([getProjects(), getCustomers()])
            .then(([p, c]) => {
                setProjects(p);
                setCustomers(c);
            })
            .catch(console.error);
    }, []);

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
                <p className="text-sm text-gray-500 mt-1">Financial reports and analytics</p>
            </div>

            {/* Card with tab navigation + content */}
            <div className="card overflow-hidden">
                {/* Tab Bar */}
                <div className="border-b border-gray-200 bg-white px-4 pt-4">
                    <div className="flex gap-1 overflow-x-auto pb-px">
                        {TABS.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    'px-4 py-2.5 text-sm font-medium whitespace-nowrap rounded-t-lg border-b-2 transition-colors',
                                    activeTab === tab.id
                                        ? 'border-primary-600 text-primary-700 bg-primary-50/60'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                )}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Tab Content */}
                <div className="p-6">
                    {activeTab === 'pnl'                && <PnlTab                 projects={projects} />}
                    {activeTab === 'plan-vs-actual'     && <PlanVsActualTab        projects={projects} />}
                    {activeTab === 'invoices'           && <InvoiceDetailsTab      projects={projects} customers={customers} />}
                    {activeTab === 'customer-tx'        && <CustomerTransactionsTab projects={projects} customers={customers} />}
                    {activeTab === 'customer-balance'   && <CustomerBalanceTab     projects={projects} customers={customers} />}
                    {activeTab === 'vat'                && <VatReportTab           projects={projects} />}
                    {activeTab === 'withholding'        && <WithholdingTaxTab      projects={projects} />}
                    {activeTab === 'payments-by-project' && <PaymentsByProjectTab  projects={projects} />}
                </div>
            </div>
        </div>
    );
}
