import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    getApartments, createApartment, updateApartment, deleteApartment,
    getPayments, createPayment, updatePayment, deletePayment, importApartments
} from '../api';
import { useProject } from '../contexts/ProjectContext';
import { ApartmentsIcon, PencilIcon, TrashIcon, XIcon, EmptyStateIcon, GridViewIcon, ListViewIcon, SearchIcon } from '../components/Icons';
import ConfirmDialog from '../components/ConfirmDialog';
import { cn, formatEUR, formatEURDecimal, formatPercent } from '../lib/utils';

const PAYMENT_METHODS = [
    { value: 'Bank Transfer', label: 'Bank Transfer' },
    { value: 'Trust Account', label: 'Trust Account' },
    { value: 'Cash', label: 'Cash' },
    { value: 'Direct to Owner', label: 'Direct to Owner' },
];

const STATUS_FILTERS = [
    { value: 'all', label: 'All' },
    { value: 'paid', label: 'Paid' },
    { value: 'partial', label: 'Partial' },
    { value: 'unpaid', label: 'Unpaid' },
];

const getApartmentStatus = (apt) => {
    if (!apt.sale_price || apt.sale_price <= 0) return 'no-sale';
    if (!apt.customer_name) return 'no-buyer';
    const paidPercent = (apt.total_paid || 0) / apt.sale_price * 100;
    if (paidPercent >= 100) return 'paid';
    if (paidPercent > 0) return 'partial';
    return 'unpaid';
};

const statusConfig = {
    'paid': { label: 'Paid', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300', dot: 'bg-emerald-500', ring: 'ring-emerald-200' },
    'partial': { label: 'Partial', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-300', dot: 'bg-amber-500', ring: 'ring-amber-200' },
    'unpaid': { label: 'Unpaid', bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-300', dot: 'bg-gray-400', ring: 'ring-gray-200' },
    'no-buyer': { label: 'No Buyer', bg: 'bg-gray-50', text: 'text-gray-400', border: 'border-gray-200', dot: 'bg-gray-300', ring: 'ring-gray-100' },
    'no-sale': { label: 'N/A', bg: 'bg-gray-50', text: 'text-gray-400', border: 'border-gray-200', dot: 'bg-gray-300', ring: 'ring-gray-100' },
};

const KpiCard = ({ label, value, colorClass, bgClass }) => (
    <div className="card-elevated p-5 flex items-center gap-4">
        <div className={cn("rounded-lg p-3", bgClass)}>
            <ApartmentsIcon className={cn("w-6 h-6", colorClass)} />
        </div>
        <div>
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-xl font-bold text-gray-900 amount">{value}</p>
        </div>
    </div>
);

const ApartmentCard = ({ apt, isSelected, onClick }) => {
    const status = getApartmentStatus(apt);
    const config = statusConfig[status];
    const progress = apt.sale_price ? (apt.total_paid / apt.sale_price) * 100 : 0;

    return (
        <div
            onClick={onClick}
            className={cn(
                "rounded-xl border-2 p-4 cursor-pointer transition-all hover:shadow-md",
                isSelected
                    ? "border-primary-400 bg-primary-50 shadow-md ring-2 ring-primary-200"
                    : cn("bg-white shadow-sm hover:border-gray-300", config.border, "border"),
            )}
        >
            <div className="flex items-start justify-between mb-2">
                <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{apt.name}</p>
                    <p className="text-xs text-gray-500 truncate">{apt.customer_name || 'No buyer'}</p>
                </div>
                <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ml-2", config.bg, config.text)}>
                    <span className={cn("w-1.5 h-1.5 rounded-full", config.dot)} />
                    {config.label}
                </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2">
                <div
                    className={cn("h-1.5 rounded-full transition-all",
                        status === 'paid' ? 'bg-emerald-500' : status === 'partial' ? 'bg-amber-500' : 'bg-gray-300'
                    )}
                    style={{ width: `${Math.min(progress, 100)}%` }}
                />
            </div>
            <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 amount">{apt.sale_price ? formatEURDecimal(apt.sale_price) : '-'}</span>
                <span className="text-xs font-medium text-gray-700 amount">{formatPercent(progress)}%</span>
            </div>
        </div>
    );
};

const Apartments = () => {
    const { selectedProjectId, projects } = useProject();
    const [apartments, setApartments] = useState([]);
    const [totalApartmentsCount, setTotalApartmentsCount] = useState(0);
    const [selectedApartment, setSelectedApartment] = useState(null);
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState(null);
    const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', onConfirm: null });

    // View controls
    const [viewMode, setViewMode] = useState('list');
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    // Client-side pagination for list view
    const [currentPage, setCurrentPage] = useState(0);
    const PAGE_SIZE = 50;

    // Payment form
    const [paymentFormData, setPaymentFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        amount: '',
        payment_method: 'Bank Transfer',
        notes: '',
    });
    const [editingPaymentId, setEditingPaymentId] = useState(null);

    // Apartment form
    const [showApartmentForm, setShowApartmentForm] = useState(false);
    const [editingApartmentId, setEditingApartmentId] = useState(null);
    const [apartmentFormData, setApartmentFormData] = useState({
        name: '', floor: '', apartment_number: '', customer_name: '',
        sale_price: '', ownership_percent: '', remarks: '',
    });

    useEffect(() => {
        if (selectedProjectId) {
            loadApartments();
        } else {
            setLoading(false);
        }
    }, [selectedProjectId]);

    const loadApartments = async (keepMessage = false) => {
        if (!selectedProjectId) return;
        if (!keepMessage) setMessage(null);
        try {
            const result = await getApartments(selectedProjectId, { skip: 0, limit: 10000 });
            const items = Array.isArray(result) ? result : (result.items || []);
            setApartments(items);
            setTotalApartmentsCount(Array.isArray(result) ? result.length : (result.total || 0));
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to load apartments' });
        } finally {
            setLoading(false);
        }
    };

    // Filtered apartments
    const filteredApartments = useMemo(() => {
        let filtered = [...apartments];

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(apt =>
                (apt.name && apt.name.toLowerCase().includes(q)) ||
                (apt.customer_name && apt.customer_name.toLowerCase().includes(q)) ||
                (apt.apartment_number && apt.apartment_number.toLowerCase().includes(q))
            );
        }

        if (statusFilter !== 'all') {
            filtered = filtered.filter(apt => {
                const status = getApartmentStatus(apt);
                if (statusFilter === 'paid') return status === 'paid';
                if (statusFilter === 'partial') return status === 'partial';
                if (statusFilter === 'unpaid') return status === 'unpaid' || status === 'no-buyer' || status === 'no-sale';
                return true;
            });
        }

        return filtered;
    }, [apartments, searchQuery, statusFilter]);

    // Client-side paginated list for list view
    const paginatedApartments = useMemo(() => {
        const start = currentPage * PAGE_SIZE;
        return filteredApartments.slice(start, start + PAGE_SIZE);
    }, [filteredApartments, currentPage]);

    // Floor-grouped for grid view
    const floorGroups = useMemo(() => {
        const groups = {};
        filteredApartments.forEach(apt => {
            const floor = apt.floor || 'Unknown';
            if (!groups[floor]) groups[floor] = [];
            groups[floor].push(apt);
        });
        const sortedKeys = Object.keys(groups).sort((a, b) => {
            const numA = parseInt(a);
            const numB = parseInt(b);
            if (!isNaN(numA) && !isNaN(numB)) return numB - numA;
            return a.localeCompare(b);
        });
        return sortedKeys.map(floor => ({
            floor,
            apartments: groups[floor],
            paid: groups[floor].filter(a => getApartmentStatus(a) === 'paid').length,
            total: groups[floor].length,
        }));
    }, [filteredApartments]);

    // Reset page when filter changes
    useEffect(() => { setCurrentPage(0); }, [searchQuery, statusFilter]);

    const loadPayments = async (apartmentId) => {
        try {
            const data = await getPayments(apartmentId);
            setPayments(data);
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to load payments' });
        }
    };

    const handleSelectApartment = async (apt) => {
        if (selectedApartment?.id === apt.id) {
            setSelectedApartment(null);
            setPayments([]);
            return;
        }
        setSelectedApartment(apt);
        setEditingPaymentId(null);
        resetPaymentForm();
        await loadPayments(apt.id);
    };

    const closePanel = () => {
        setSelectedApartment(null);
        setPayments([]);
    };

    // --- Apartment CRUD ---
    const resetApartmentForm = () => {
        setApartmentFormData({
            name: '', floor: '', apartment_number: '', customer_name: '',
            sale_price: '', ownership_percent: '', remarks: '',
        });
        setEditingApartmentId(null);
        setShowApartmentForm(false);
    };

    const handleAddApartment = () => {
        resetApartmentForm();
        setShowApartmentForm(true);
    };

    const handleEditApartment = (apt) => {
        setApartmentFormData({
            name: apt.name || '',
            floor: apt.floor || '',
            apartment_number: apt.apartment_number || '',
            customer_name: apt.customer_name || '',
            sale_price: apt.sale_price ?? '',
            ownership_percent: apt.ownership_percent ?? '',
            remarks: apt.remarks || '',
        });
        setEditingApartmentId(apt.id);
        setShowApartmentForm(true);
    };

    const handleSaveApartment = async () => {
        const data = {
            ...apartmentFormData,
            sale_price: apartmentFormData.sale_price ? parseFloat(apartmentFormData.sale_price) : null,
            ownership_percent: apartmentFormData.ownership_percent ? parseFloat(apartmentFormData.ownership_percent) : null,
        };
        try {
            if (editingApartmentId) {
                await updateApartment(editingApartmentId, data);
                setMessage({ type: 'success', text: 'Apartment updated successfully' });
            } else {
                await createApartment(selectedProjectId, data);
                setMessage({ type: 'success', text: 'Apartment added successfully' });
            }
            resetApartmentForm();
            await loadApartments();
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to save apartment' });
        }
    };

    const handleDeleteApartment = (id) => {
        setConfirmDialog({
            open: true,
            title: 'Delete Apartment',
            message: 'Delete this apartment? All payments will also be deleted.',
            onConfirm: async () => {
                setConfirmDialog({ open: false, title: '', message: '', onConfirm: null });
                try {
                    await deleteApartment(id);
                    if (selectedApartment?.id === id) closePanel();
                    await loadApartments();
                    setMessage({ type: 'success', text: 'Apartment deleted' });
                } catch (error) {
                    setMessage({ type: 'error', text: 'Failed to delete apartment' });
                }
            },
        });
    };

    // --- Payment CRUD ---
    const resetPaymentForm = () => {
        setPaymentFormData({
            date: new Date().toISOString().split('T')[0],
            amount: '',
            payment_method: 'Bank Transfer',
            notes: '',
        });
        setEditingPaymentId(null);
    };

    const handleSavePayment = async () => {
        if (!paymentFormData.amount || !paymentFormData.date) {
            setMessage({ type: 'error', text: 'Please fill in date and amount' });
            return;
        }
        const data = {
            ...paymentFormData,
            date: new Date(paymentFormData.date).toISOString(),
            amount: parseFloat(paymentFormData.amount),
        };
        try {
            if (editingPaymentId) {
                await updatePayment(editingPaymentId, data);
                setMessage({ type: 'success', text: 'Payment updated' });
            } else {
                await createPayment(selectedApartment.id, data);
                setMessage({ type: 'success', text: 'Payment added' });
            }
            resetPaymentForm();
            await loadPayments(selectedApartment.id);
            await loadApartments();
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to save payment' });
        }
    };

    const handleEditPayment = (payment) => {
        setPaymentFormData({
            date: payment.date.split('T')[0],
            amount: payment.amount.toString(),
            payment_method: payment.payment_method,
            notes: payment.notes || '',
        });
        setEditingPaymentId(payment.id);
    };

    const handleDeletePayment = (id) => {
        setConfirmDialog({
            open: true,
            title: 'Delete Payment',
            message: 'Delete this payment?',
            onConfirm: async () => {
                setConfirmDialog({ open: false, title: '', message: '', onConfirm: null });
                try {
                    await deletePayment(id);
                    await loadPayments(selectedApartment.id);
                    await loadApartments();
                    setMessage({ type: 'success', text: 'Payment deleted' });
                } catch (error) {
                    setMessage({ type: 'error', text: 'Failed to delete payment' });
                }
            },
        });
    };

    // --- CSV Import with Preview ---
    const fileInputRef = useRef(null);
    const [csvPreview, setCsvPreview] = useState(null); // { rows, warnings, file }
    const [importLoading, setImportLoading] = useState(false);

    const handleImport = () => {
        fileInputRef.current?.click();
    };

    const handleDownloadTemplate = () => {
        const headers = 'Project,ProjectKey,Floor,Appartment,Price,Percent,Customer,CustomerKey,remarks';
        const example = 'Athens Luxury,1,4,1,250000,50,John Smith,100,Corner unit';
        const csv = headers + '\n' + example + '\n';
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'apartments_template.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    const parseCSV = (text) => {
        const lines = text.replace(/\r\n/g, '\n').split('\n').filter(l => l.trim());
        if (lines.length < 2) return { rows: [], headers: [] };
        const headers = lines[0].split(',').map(h => h.trim());
        const rows = [];
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            const row = {};
            headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
            rows.push(row);
        }
        return { rows, headers };
    };

    const handleFileSelected = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        e.target.value = '';

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target.result;
            const { rows, headers } = parseCSV(text);

            // Validate
            const warnings = [];
            const projectNames = new Set((projects || []).map(p => p.name.toLowerCase().trim()));
            const unmappedProjects = new Set();
            let emptyRows = 0;
            let missingPrice = 0;

            rows.forEach((row, idx) => {
                const project = (row.Project || '').trim();
                const projectKey = (row.ProjectKey || '0').trim();
                if (!project || projectKey === '0') {
                    emptyRows++;
                    return;
                }
                if (!projectNames.has(project.toLowerCase())) {
                    unmappedProjects.add(project);
                }
                if (!row.Price || row.Price.trim() === '' || row.Price.trim() === '0') {
                    missingPrice++;
                }
            });

            if (unmappedProjects.size > 0) {
                warnings.push({ type: 'error', text: `Unmapped projects (will be skipped): ${[...unmappedProjects].join(', ')}` });
            }
            if (emptyRows > 0) {
                warnings.push({ type: 'info', text: `${emptyRows} empty/padding rows will be skipped` });
            }
            if (missingPrice > 0) {
                warnings.push({ type: 'warn', text: `${missingPrice} rows have no price` });
            }

            const validRows = rows.filter(row => {
                const project = (row.Project || '').trim();
                const projectKey = (row.ProjectKey || '0').trim();
                return project && projectKey !== '0';
            });

            setCsvPreview({ rows, validRows, warnings, file, headers });
        };
        reader.readAsText(file);
    };

    const handleConfirmImport = async () => {
        if (!csvPreview?.file) return;
        setImportLoading(true);
        try {
            const result = await importApartments(csvPreview.file);
            let msg = `Imported ${result.imported} apartments, skipped ${result.skipped}`;
            if (result.unmapped_projects?.length > 0) {
                msg += `. Unmapped projects: ${result.unmapped_projects.join(', ')}`;
            }
            setMessage({ type: 'success', text: msg });
            setCsvPreview(null);
            await loadApartments(true);
        } catch (error) {
            setMessage({ type: 'error', text: 'Import failed' });
        } finally {
            setImportLoading(false);
        }
    };

    const handleCancelImport = () => {
        setCsvPreview(null);
    };

    // --- KPI Calculations (from ALL apartments, not filtered) ---
    const totalApartments = apartments.length;
    const totalRevenue = apartments.reduce((sum, a) => sum + (a.sale_price || 0), 0);
    const totalCollected = apartments.reduce((sum, a) => sum + (a.total_paid || 0), 0);
    const collectionPercent = totalRevenue > 0 ? (totalCollected / totalRevenue) * 100 : 0;

    // --- Payment Form Component (shared by grid slide-out and list inline) ---
    const PaymentFormSection = () => (
        <div className="bg-white rounded-lg p-4 border border-gray-200">
            <h5 className="font-medium text-gray-700 mb-3">{editingPaymentId ? 'Edit Payment' : 'Add Payment'}</h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <label className="label text-xs">{'Date'}</label>
                    <input type="date" className="input-field text-sm"
                        value={paymentFormData.date}
                        onChange={e => setPaymentFormData({...paymentFormData, date: e.target.value})} />
                </div>
                <div>
                    <label className="label text-xs">{'Amount (EUR)'}</label>
                    <input type="number" step="0.01" className="input-field text-sm"
                        value={paymentFormData.amount}
                        onChange={e => setPaymentFormData({...paymentFormData, amount: e.target.value})} />
                </div>
                <div>
                    <label className="label text-xs">{'Payment Method'}</label>
                    <select className="input-field text-sm"
                        value={paymentFormData.payment_method}
                        onChange={e => setPaymentFormData({...paymentFormData, payment_method: e.target.value})}>
                        {PAYMENT_METHODS.map(m => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="label text-xs">{'Notes'}</label>
                    <input type="text" className="input-field text-sm"
                        value={paymentFormData.notes}
                        onChange={e => setPaymentFormData({...paymentFormData, notes: e.target.value})} />
                </div>
            </div>
            <div className="flex gap-2 mt-3">
                <button onClick={handleSavePayment} className="btn-primary text-sm py-2 px-4">
                    {editingPaymentId ? 'Update' : 'Add'}
                </button>
                {editingPaymentId && (
                    <button onClick={resetPaymentForm} className="btn-secondary text-sm py-2 px-4">{'Cancel'}</button>
                )}
            </div>
        </div>
    );

    const PaymentTableSection = () => (
        payments.length > 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">{'Date'}</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">{'Amount'}</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">{'Method'}</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">{'Notes'}</th>
                            <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">{'Actions'}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                        {payments.map(p => (
                            <tr key={p.id} className="hover:bg-gray-50">
                                <td className="px-4 py-2">{new Date(p.date).toLocaleDateString('en-GB')}</td>
                                <td className="px-4 py-2 text-right amount">{formatEURDecimal(p.amount)}</td>
                                <td className="px-4 py-2">{p.payment_method}</td>
                                <td className="px-4 py-2 text-gray-500">{p.notes || '-'}</td>
                                <td className="px-4 py-2">
                                    <div className="flex items-center gap-1 justify-center">
                                        <button onClick={() => handleEditPayment(p)}
                                            className="p-1 rounded text-gray-400 hover:text-primary-600 hover:bg-primary-50">
                                            <PencilIcon className="w-3.5 h-3.5" />
                                        </button>
                                        <button onClick={() => handleDeletePayment(p.id)}
                                            className="p-1 rounded text-gray-400 hover:text-rose-600 hover:bg-rose-50">
                                            <TrashIcon className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        ) : (
            <p className="text-sm text-gray-400 text-center py-3">{'No payments yet'}</p>
        )
    );

    if (loading) {
        return (
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
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center flex-wrap gap-3">
                <h2 className="text-2xl font-bold text-gray-900">{'Apartments & Payments'}</h2>
                <div className="flex items-center gap-3">
                    <input
                        type="file"
                        ref={fileInputRef}
                        accept=".csv"
                        onChange={handleFileSelected}
                        className="hidden"
                    />
                    <div className="flex flex-col items-center gap-1">
                        <button onClick={handleImport} className="btn-secondary text-sm">
                            {'Import CSV'}
                        </button>
                        <button onClick={handleDownloadTemplate} className="text-xs text-slate-400 hover:text-teal-400 underline">
                            {'Download Template'}
                        </button>
                    </div>
                    <button onClick={handleAddApartment} className="btn-primary text-sm">
                        {'+ New Apartment'}
                    </button>
                </div>
            </div>

            {message && (
                <div className={cn(
                    'p-4 rounded-lg text-sm font-medium',
                    message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                )}>
                    {message.text}
                </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard label={'Total Apartments'} value={totalApartments} colorClass="text-primary-600" bgClass="bg-primary-50" />
                <KpiCard label={'Expected Revenue'} value={formatEUR(totalRevenue)} colorClass="text-emerald-600" bgClass="bg-emerald-50" />
                <KpiCard label={'Collected'} value={formatEUR(totalCollected)} colorClass="text-blue-600" bgClass="bg-blue-50" />
                <KpiCard label={'Collection %'} value={`${formatPercent(collectionPercent)}%`} colorClass="text-amber-600" bgClass="bg-amber-50" />
            </div>

            {/* Search, Filter & View Controls */}
            <div className="flex items-center gap-3 flex-wrap">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px] max-w-md">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search apartment or customer..."
                        className="input-field pl-9 !mt-0"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>

                {/* Status Filter Chips */}
                <div className="flex bg-gray-100 rounded-lg p-0.5">
                    {STATUS_FILTERS.map(f => (
                        <button key={f.value}
                            onClick={() => setStatusFilter(f.value)}
                            className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                                statusFilter === f.value ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                            )}
                        >{f.label}</button>
                    ))}
                </div>

                {/* View Toggle */}
                <div className="flex bg-gray-100 rounded-lg p-0.5">
                    <button
                        onClick={() => setViewMode('list')}
                        className={cn("p-1.5 rounded-md transition-colors",
                            viewMode === 'list' ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                        )}
                        title="List View"
                    >
                        <ListViewIcon className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setViewMode('grid')}
                        className={cn("p-1.5 rounded-md transition-colors",
                            viewMode === 'grid' ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                        )}
                        title="Grid View"
                    >
                        <GridViewIcon className="w-4 h-4" />
                    </button>
                </div>

                {/* Result count */}
                {(searchQuery || statusFilter !== 'all') && (
                    <span className="text-xs text-gray-500">
                        {filteredApartments.length} of {apartments.length} shown
                    </span>
                )}
            </div>

            {/* Apartment Form (inline) */}
            {showApartmentForm && (
                <div className="card p-6 space-y-4">
                    <h3 className="text-lg font-semibold">{editingApartmentId ? 'Edit Apartment' : 'New Apartment'}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                            <label className="label">{'Name'}</label>
                            <input type="text" className="input-field" value={apartmentFormData.name}
                                onChange={e => setApartmentFormData({...apartmentFormData, name: e.target.value})} />
                        </div>
                        <div>
                            <label className="label">{'Floor'}</label>
                            <input type="text" className="input-field" value={apartmentFormData.floor}
                                onChange={e => setApartmentFormData({...apartmentFormData, floor: e.target.value})} />
                        </div>
                        <div>
                            <label className="label">{'Apt Number'}</label>
                            <input type="text" className="input-field" value={apartmentFormData.apartment_number}
                                onChange={e => setApartmentFormData({...apartmentFormData, apartment_number: e.target.value})} />
                        </div>
                        <div>
                            <label className="label">{'Customer Name'}</label>
                            <input type="text" className="input-field" value={apartmentFormData.customer_name}
                                onChange={e => setApartmentFormData({...apartmentFormData, customer_name: e.target.value})} />
                        </div>
                        <div>
                            <label className="label">{'Sale Price (EUR)'}</label>
                            <input type="number" step="0.01" className="input-field" value={apartmentFormData.sale_price}
                                onChange={e => setApartmentFormData({...apartmentFormData, sale_price: e.target.value})} />
                        </div>
                        <div>
                            <label className="label">{'Ownership %'}</label>
                            <input type="number" step="0.0001" className="input-field" value={apartmentFormData.ownership_percent}
                                onChange={e => setApartmentFormData({...apartmentFormData, ownership_percent: e.target.value})} />
                        </div>
                        <div className="sm:col-span-2 lg:col-span-3">
                            <label className="label">{'Notes'}</label>
                            <input type="text" className="input-field" value={apartmentFormData.remarks}
                                onChange={e => setApartmentFormData({...apartmentFormData, remarks: e.target.value})} />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleSaveApartment} className="btn-primary text-sm">{'Save'}</button>
                        <button onClick={resetApartmentForm} className="btn-secondary text-sm">{'Cancel'}</button>
                    </div>
                </div>
            )}

            {/* CSV Import Preview Modal */}
            {csvPreview && (
                <>
                    <div className="fixed inset-0 bg-black/30 z-40" onClick={handleCancelImport} />
                    <div className="fixed inset-4 md:inset-10 lg:inset-16 bg-white rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">Import Preview</h3>
                                <p className="text-sm text-gray-500">
                                    {csvPreview.validRows.length} valid rows of {csvPreview.rows.length} total
                                </p>
                            </div>
                            <button onClick={handleCancelImport} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Warnings */}
                        {csvPreview.warnings.length > 0 && (
                            <div className="px-6 py-3 space-y-2 border-b border-gray-100 bg-gray-50">
                                {csvPreview.warnings.map((w, i) => (
                                    <div key={i} className={cn(
                                        "text-sm px-3 py-1.5 rounded-lg",
                                        w.type === 'error' ? 'bg-rose-50 text-rose-700' :
                                        w.type === 'warn' ? 'bg-amber-50 text-amber-700' :
                                        'bg-sky-50 text-sky-700'
                                    )}>
                                        {w.text}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Preview Table */}
                        <div className="flex-1 overflow-auto px-6 py-4">
                            <table className="min-w-full divide-y divide-gray-200 text-sm">
                                <thead className="bg-slate-50 sticky top-0">
                                    <tr>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Project</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Floor</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Apt</th>
                                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Price</th>
                                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">%</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {csvPreview.rows.map((row, i) => {
                                        const project = (row.Project || '').trim();
                                        const projectKey = (row.ProjectKey || '0').trim();
                                        const isSkipped = !project || projectKey === '0';
                                        const projectNames = (projects || []).map(p => p.name.toLowerCase().trim());
                                        const isUnmapped = project && !projectNames.includes(project.toLowerCase());

                                        return (
                                            <tr key={i} className={cn(
                                                isSkipped ? 'opacity-40' : isUnmapped ? 'bg-rose-50/50' : 'hover:bg-gray-50'
                                            )}>
                                                <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                                                <td className={cn("px-3 py-2", isUnmapped && "text-rose-600 font-medium")}>{project || '-'}</td>
                                                <td className="px-3 py-2">{row.Floor || '-'}</td>
                                                <td className="px-3 py-2">{row.Appartment || '-'}</td>
                                                <td className="px-3 py-2 text-right amount">{row.Price || '-'}</td>
                                                <td className="px-3 py-2 text-right">{row.Percent || '-'}</td>
                                                <td className="px-3 py-2">{row.Customer || '-'}</td>
                                                <td className="px-3 py-2 text-gray-500">{row.remarks || '-'}</td>
                                                <td className="px-3 py-2">
                                                    {isSkipped ? (
                                                        <span className="text-xs text-gray-400">Skip</span>
                                                    ) : isUnmapped ? (
                                                        <span className="text-xs text-rose-600 font-medium">Unmapped</span>
                                                    ) : (
                                                        <span className="text-xs text-emerald-600 font-medium">Ready</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
                            <p className="text-sm text-gray-500">
                                {csvPreview.validRows.length} rows will be imported
                            </p>
                            <div className="flex gap-3">
                                <button onClick={handleCancelImport} className="btn-secondary text-sm">
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmImport}
                                    disabled={importLoading || csvPreview.validRows.length === 0}
                                    className="btn-primary text-sm disabled:opacity-50"
                                >
                                    {importLoading ? 'Importing...' : `Import ${csvPreview.validRows.length} Apartments`}
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Content */}
            {filteredApartments.length === 0 && !showApartmentForm ? (
                <div className="card">
                    <div className="flex flex-col items-center justify-center py-16 px-4">
                        <EmptyStateIcon className="w-16 h-16 text-gray-300 mb-4" />
                        <p className="text-gray-500 text-sm">
                            {apartments.length === 0 ? 'No apartments in this project.' : 'No apartments match your filters.'}
                        </p>
                    </div>
                </div>
            ) : viewMode === 'grid' ? (
                /* ============= GRID VIEW ============= */
                <div className="space-y-6">
                    {floorGroups.map(group => (
                        <div key={group.floor}>
                            <div className="flex items-center gap-3 mb-3">
                                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                                    {'Floor'} {group.floor}
                                </h3>
                                <span className="text-xs text-gray-400">
                                    {group.paid}/{group.total} paid
                                </span>
                                <div className="flex-1 border-t border-gray-200" />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                {group.apartments.map(apt => (
                                    <ApartmentCard
                                        key={apt.id}
                                        apt={apt}
                                        isSelected={selectedApartment?.id === apt.id}
                                        onClick={() => handleSelectApartment(apt)}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                /* ============= LIST VIEW ============= */
                <div className="card overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100">
                        <h3 className="text-lg font-semibold text-gray-900">{'Apartment List'}</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{'Apartment'}</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{'Customer'}</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{'Sale Price'}</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{'Total Paid'}</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{'Balance'}</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">{'Progress'}</th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{'Actions'}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm">
                                {paginatedApartments.map((apt, index) => {
                                    const progress = apt.sale_price ? (apt.total_paid / apt.sale_price) * 100 : 0;
                                    const isSelected = selectedApartment?.id === apt.id;
                                    return (
                                        <React.Fragment key={apt.id}>
                                            <tr className={cn('hover:bg-gray-50 cursor-pointer', isSelected && 'bg-primary-50', index % 2 !== 0 && !isSelected && 'bg-slate-50/50')}
                                                onClick={() => handleSelectApartment(apt)}>
                                                <td className="px-6 py-3 whitespace-nowrap font-medium text-gray-900">{apt.name}</td>
                                                <td className="px-6 py-3 whitespace-nowrap text-gray-700">{apt.customer_name || '-'}</td>
                                                <td className="px-6 py-3 whitespace-nowrap text-right amount">{apt.sale_price ? formatEURDecimal(apt.sale_price) : '-'}</td>
                                                <td className="px-6 py-3 whitespace-nowrap text-right amount">{formatEURDecimal(apt.total_paid)}</td>
                                                <td className="px-6 py-3 whitespace-nowrap text-right amount">{apt.remaining != null ? formatEURDecimal(apt.remaining) : '-'}</td>
                                                <td className="px-6 py-3 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                                                            <div
                                                                className="h-2 rounded-full bg-emerald-500 transition-all"
                                                                style={{ width: `${Math.min(progress, 100)}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-xs w-14 text-right font-medium text-gray-600">
                                                            {formatPercent(progress)}%
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-3 whitespace-nowrap">
                                                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                                        <button onClick={() => handleEditApartment(apt)}
                                                            className="p-1 rounded text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors" title={'Edit'}>
                                                            <PencilIcon className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => handleDeleteApartment(apt.id)}
                                                            className="p-1 rounded text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors" title={'Delete'}>
                                                            <TrashIcon className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* Inline Detail Panel (List view) */}
                                            {isSelected && (
                                                <tr>
                                                    <td colSpan={7} className="px-6 py-4 bg-slate-50 border-t border-primary-200">
                                                        <div className="space-y-4">
                                                            <div className="flex items-center justify-between">
                                                                <div>
                                                                    <h4 className="font-semibold text-gray-900">{apt.name}</h4>
                                                                    <p className="text-sm text-gray-500">
                                                                        {apt.customer_name || 'No customer'} | {'Price:'} {apt.sale_price ? formatEURDecimal(apt.sale_price) : '-'} | {'Paid:'} {formatEURDecimal(apt.total_paid)} | {'Balance:'} {apt.remaining != null ? formatEURDecimal(apt.remaining) : '-'}
                                                                    </p>
                                                                </div>
                                                                <button onClick={closePanel}
                                                                    className="text-sm text-primary-600 hover:text-primary-800">
                                                                    {'Back to List'}
                                                                </button>
                                                            </div>
                                                            <PaymentFormSection />
                                                            <PaymentTableSection />
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {/* Client-side pagination */}
                    {filteredApartments.length > PAGE_SIZE && (
                        <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
                            <span>
                                Showing {currentPage * PAGE_SIZE + 1}-{Math.min((currentPage + 1) * PAGE_SIZE, filteredApartments.length)} of {filteredApartments.length}
                            </span>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                                    disabled={currentPage === 0}
                                    className="px-3 py-1 rounded border border-gray-300 text-sm disabled:opacity-50 hover:bg-gray-50"
                                >Previous</button>
                                <button
                                    onClick={() => setCurrentPage(p => p + 1)}
                                    disabled={(currentPage + 1) * PAGE_SIZE >= filteredApartments.length}
                                    className="px-3 py-1 rounded border border-gray-300 text-sm disabled:opacity-50 hover:bg-gray-50"
                                >Next</button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Slide-Out Panel (Grid view) */}
            {selectedApartment && viewMode === 'grid' && (
                <>
                    <div className="fixed inset-0 bg-black/20 z-40" onClick={closePanel} />
                    <div className="fixed inset-y-0 right-0 w-[420px] max-w-full bg-white shadow-2xl z-50 overflow-y-auto border-l border-gray-200">
                        <div className="p-6 space-y-5">
                            {/* Header */}
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900">{selectedApartment.name}</h3>
                                    <p className="text-sm text-gray-500">
                                        {'Floor'} {selectedApartment.floor || '-'} &middot; {selectedApartment.customer_name || 'No buyer'}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => handleEditApartment(selectedApartment)}
                                        className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50">
                                        <PencilIcon className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDeleteApartment(selectedApartment.id)}
                                        className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50">
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                    <button onClick={closePanel}
                                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                                        <XIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Summary */}
                            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">{'Sale Price'}</span>
                                    <span className="font-medium amount">{selectedApartment.sale_price ? formatEURDecimal(selectedApartment.sale_price) : '-'}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">{'Paid'}</span>
                                    <span className="font-medium text-emerald-600 amount">{formatEURDecimal(selectedApartment.total_paid)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">{'Remaining'}</span>
                                    <span className="font-medium text-rose-600 amount">{selectedApartment.remaining != null ? formatEURDecimal(selectedApartment.remaining) : '-'}</span>
                                </div>
                                <div className="pt-1">
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                                            <div className="h-2 rounded-full bg-emerald-500 transition-all"
                                                style={{ width: `${Math.min((selectedApartment.sale_price ? (selectedApartment.total_paid / selectedApartment.sale_price) * 100 : 0), 100)}%` }} />
                                        </div>
                                        <span className="text-xs font-medium text-gray-600">
                                            {formatPercent(selectedApartment.sale_price ? (selectedApartment.total_paid / selectedApartment.sale_price) * 100 : 0)}%
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Payment Form */}
                            <PaymentFormSection />

                            {/* Payment History */}
                            <div>
                                <h5 className="font-medium text-gray-700 mb-3">{'Payment History'}</h5>
                                <PaymentTableSection />
                            </div>
                        </div>
                    </div>
                </>
            )}

            <ConfirmDialog
                open={confirmDialog.open}
                title={confirmDialog.title}
                message={confirmDialog.message}
                onConfirm={confirmDialog.onConfirm || (() => {})}
                onCancel={() => setConfirmDialog({ open: false, title: '', message: '', onConfirm: null })}
            />
        </div>
    );
};

export default Apartments;
