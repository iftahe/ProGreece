import React, { useState, useEffect, useRef } from 'react';
import {
    getProjects, getApartments, createApartment, updateApartment, deleteApartment,
    getPayments, createPayment, updatePayment, deletePayment, importApartments
} from '../api';
import { ApartmentsIcon, PencilIcon, TrashIcon, CheckIcon, XIcon, EmptyStateIcon } from '../components/Icons';
import { cn, formatEUR, formatEURDecimal, formatPercent } from '../lib/utils';

const PAYMENT_METHODS = [
    { value: 'Bank Transfer', label: 'Bank Transfer' },
    { value: 'Trust Account', label: 'Trust Account' },
    { value: 'Cash', label: 'Cash' },
    { value: 'Direct to Owner', label: 'Direct to Owner' },
];

const KpiCard = ({ label, value, colorClass, bgClass }) => (
    <div className="card p-5 flex items-center gap-4">
        <div className={cn("rounded-lg p-3", bgClass)}>
            <ApartmentsIcon className={cn("w-6 h-6", colorClass)} />
        </div>
        <div>
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-xl font-bold text-gray-900">{value}</p>
        </div>
    </div>
);

const Apartments = () => {
    const [projects, setProjects] = useState([]);
    const [selectedProjectId, setSelectedProjectId] = useState(null);
    const [apartments, setApartments] = useState([]);
    const [selectedApartment, setSelectedApartment] = useState(null);
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState(null);

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
            loadApartments();
        }
    }, [selectedProjectId]);

    const loadApartments = async (keepMessage = false) => {
        if (!selectedProjectId) return;
        if (!keepMessage) setMessage(null);
        try {
            const data = await getApartments(selectedProjectId);
            setApartments(data);
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to load apartments' });
        } finally {
            setLoading(false);
        }
    };

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

    const handleDeleteApartment = async (id) => {
        if (!confirm('Delete this apartment? All payments will also be deleted.')) return;
        try {
            await deleteApartment(id);
            if (selectedApartment?.id === id) {
                setSelectedApartment(null);
                setPayments([]);
            }
            await loadApartments();
            setMessage({ type: 'success', text: 'Apartment deleted' });
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to delete apartment' });
        }
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

    const handleDeletePayment = async (id) => {
        if (!confirm('Delete this payment?')) return;
        try {
            await deletePayment(id);
            await loadPayments(selectedApartment.id);
            await loadApartments();
            setMessage({ type: 'success', text: 'Payment deleted' });
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to delete payment' });
        }
    };

    // --- CSV Import ---
    const fileInputRef = useRef(null);

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

    const handleFileSelected = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        // Reset input so the same file can be re-selected
        e.target.value = '';
        try {
            const result = await importApartments(file);
            let msg = `Imported ${result.imported} apartments, skipped ${result.skipped}`;
            if (result.unmapped_projects?.length > 0) {
                msg += `. Unmapped projects: ${result.unmapped_projects.join(', ')}`;
            }
            setMessage({ type: 'success', text: msg });
            await loadApartments(true);
        } catch (error) {
            setMessage({ type: 'error', text: 'Import failed' });
        }
    };

    // --- KPI Calculations ---
    const totalApartments = apartments.length;
    const totalRevenue = apartments.reduce((sum, a) => sum + (a.sale_price || 0), 0);
    const totalCollected = apartments.reduce((sum, a) => sum + (a.total_paid || 0), 0);
    const collectionPercent = totalRevenue > 0 ? (totalCollected / totalRevenue) * 100 : 0;

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
                <h2 className="text-2xl font-bold text-gray-900">Apartments & Payments</h2>
                <div className="flex items-center gap-3">
                    {projects.length > 0 && (
                        <select
                            value={selectedProjectId || ''}
                            onChange={(e) => {
                                setSelectedProjectId(parseInt(e.target.value));
                                setSelectedApartment(null);
                                setPayments([]);
                            }}
                            className="input-field w-auto min-w-[200px]"
                        >
                            {projects.map(project => (
                                <option key={project.id} value={project.id}>
                                    {project.name}
                                </option>
                            ))}
                        </select>
                    )}
                    <input
                        type="file"
                        ref={fileInputRef}
                        accept=".csv"
                        onChange={handleFileSelected}
                        className="hidden"
                    />
                    <div className="flex flex-col items-center gap-1">
                        <button onClick={handleImport} className="btn-secondary text-sm">
                            Import CSV
                        </button>
                        <button onClick={handleDownloadTemplate} className="text-xs text-slate-400 hover:text-teal-400 underline">
                            Download template
                        </button>
                    </div>
                    <button onClick={handleAddApartment} className="btn-primary text-sm">
                        + New Apartment
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
                <KpiCard label="Total Apartments" value={totalApartments} colorClass="text-primary-600" bgClass="bg-primary-50" />
                <KpiCard label="Total Revenue" value={formatEUR(totalRevenue)} colorClass="text-emerald-600" bgClass="bg-emerald-50" />
                <KpiCard label="Total Collected" value={formatEUR(totalCollected)} colorClass="text-blue-600" bgClass="bg-blue-50" />
                <KpiCard label="Collection %" value={`${formatPercent(collectionPercent)}%`} colorClass="text-amber-600" bgClass="bg-amber-50" />
            </div>

            {/* Apartment Form (inline) */}
            {showApartmentForm && (
                <div className="card p-6 space-y-4">
                    <h3 className="text-lg font-semibold">{editingApartmentId ? 'Edit Apartment' : 'New Apartment'}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                            <label className="label">Name</label>
                            <input type="text" className="input-field" value={apartmentFormData.name}
                                onChange={e => setApartmentFormData({...apartmentFormData, name: e.target.value})} />
                        </div>
                        <div>
                            <label className="label">Floor</label>
                            <input type="text" className="input-field" value={apartmentFormData.floor}
                                onChange={e => setApartmentFormData({...apartmentFormData, floor: e.target.value})} />
                        </div>
                        <div>
                            <label className="label">Apartment Number</label>
                            <input type="text" className="input-field" value={apartmentFormData.apartment_number}
                                onChange={e => setApartmentFormData({...apartmentFormData, apartment_number: e.target.value})} />
                        </div>
                        <div>
                            <label className="label">Customer Name</label>
                            <input type="text" className="input-field" value={apartmentFormData.customer_name}
                                onChange={e => setApartmentFormData({...apartmentFormData, customer_name: e.target.value})} />
                        </div>
                        <div>
                            <label className="label">Sale Price (EUR)</label>
                            <input type="number" step="0.01" className="input-field" value={apartmentFormData.sale_price}
                                onChange={e => setApartmentFormData({...apartmentFormData, sale_price: e.target.value})} />
                        </div>
                        <div>
                            <label className="label">Ownership %</label>
                            <input type="number" step="0.0001" className="input-field" value={apartmentFormData.ownership_percent}
                                onChange={e => setApartmentFormData({...apartmentFormData, ownership_percent: e.target.value})} />
                        </div>
                        <div className="sm:col-span-2 lg:col-span-3">
                            <label className="label">Remarks</label>
                            <input type="text" className="input-field" value={apartmentFormData.remarks}
                                onChange={e => setApartmentFormData({...apartmentFormData, remarks: e.target.value})} />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleSaveApartment} className="btn-primary text-sm">Save</button>
                        <button onClick={resetApartmentForm} className="btn-secondary text-sm">Cancel</button>
                    </div>
                </div>
            )}

            {/* Apartments Table */}
            {apartments.length === 0 && !showApartmentForm ? (
                <div className="card">
                    <div className="flex flex-col items-center justify-center py-16 px-4">
                        <EmptyStateIcon className="w-16 h-16 text-gray-300 mb-4" />
                        <p className="text-gray-500 text-sm">No apartments in this project.</p>
                    </div>
                </div>
            ) : apartments.length > 0 && (
                <div className="card overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100">
                        <h3 className="text-lg font-semibold text-gray-900">Apartments List</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Apartment</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Sale Price</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Paid</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Remaining</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">Progress</th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm">
                                {apartments.map((apt, index) => {
                                    const progress = apt.sale_price ? (apt.total_paid / apt.sale_price) * 100 : 0;
                                    const isSelected = selectedApartment?.id === apt.id;
                                    return (
                                        <React.Fragment key={apt.id}>
                                            <tr className={cn('hover:bg-gray-50 cursor-pointer', isSelected && 'bg-primary-50', index % 2 !== 0 && !isSelected && 'bg-slate-50/50')}
                                                onClick={() => handleSelectApartment(apt)}>
                                                <td className="px-6 py-3 whitespace-nowrap font-medium text-gray-900">{apt.name}</td>
                                                <td className="px-6 py-3 whitespace-nowrap text-gray-700">{apt.customer_name || '-'}</td>
                                                <td className="px-6 py-3 whitespace-nowrap text-right">{apt.sale_price ? formatEURDecimal(apt.sale_price) : '-'}</td>
                                                <td className="px-6 py-3 whitespace-nowrap text-right">{formatEURDecimal(apt.total_paid)}</td>
                                                <td className="px-6 py-3 whitespace-nowrap text-right">{apt.remaining != null ? formatEURDecimal(apt.remaining) : '-'}</td>
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
                                                            className="p-1 rounded text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors" title="Edit">
                                                            <PencilIcon className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => handleDeleteApartment(apt.id)}
                                                            className="p-1 rounded text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors" title="Delete">
                                                            <TrashIcon className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* Detail Panel */}
                                            {isSelected && (
                                                <tr>
                                                    <td colSpan={7} className="px-6 py-4 bg-slate-50 border-t border-primary-200">
                                                        <div className="space-y-4">
                                                            {/* Apartment Info */}
                                                            <div className="flex items-center justify-between">
                                                                <div>
                                                                    <h4 className="font-semibold text-gray-900">{apt.name}</h4>
                                                                    <p className="text-sm text-gray-500">
                                                                        {apt.customer_name || 'No customer'} | Price: {apt.sale_price ? formatEURDecimal(apt.sale_price) : '-'} | Paid: {formatEURDecimal(apt.total_paid)} | Remaining: {apt.remaining != null ? formatEURDecimal(apt.remaining) : '-'}
                                                                    </p>
                                                                </div>
                                                                <button onClick={() => { setSelectedApartment(null); setPayments([]); }}
                                                                    className="text-sm text-primary-600 hover:text-primary-800">
                                                                    Back to list
                                                                </button>
                                                            </div>

                                                            {/* Payment Form */}
                                                            <div className="bg-white rounded-lg p-4 border border-gray-200">
                                                                <h5 className="font-medium text-gray-700 mb-3">{editingPaymentId ? 'Edit Payment' : 'Add Payment'}</h5>
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                                                                    <div>
                                                                        <label className="label text-xs">Date</label>
                                                                        <input type="date" className="input-field text-sm"
                                                                            value={paymentFormData.date}
                                                                            onChange={e => setPaymentFormData({...paymentFormData, date: e.target.value})} />
                                                                    </div>
                                                                    <div>
                                                                        <label className="label text-xs">Amount (EUR)</label>
                                                                        <input type="number" step="0.01" className="input-field text-sm"
                                                                            value={paymentFormData.amount}
                                                                            onChange={e => setPaymentFormData({...paymentFormData, amount: e.target.value})} />
                                                                    </div>
                                                                    <div>
                                                                        <label className="label text-xs">Payment Method</label>
                                                                        <select className="input-field text-sm"
                                                                            value={paymentFormData.payment_method}
                                                                            onChange={e => setPaymentFormData({...paymentFormData, payment_method: e.target.value})}>
                                                                            {PAYMENT_METHODS.map(m => (
                                                                                <option key={m.value} value={m.value}>{m.label}</option>
                                                                            ))}
                                                                        </select>
                                                                    </div>
                                                                    <div>
                                                                        <label className="label text-xs">Notes</label>
                                                                        <input type="text" className="input-field text-sm"
                                                                            value={paymentFormData.notes}
                                                                            onChange={e => setPaymentFormData({...paymentFormData, notes: e.target.value})} />
                                                                    </div>
                                                                    <div className="flex items-end gap-2">
                                                                        <button onClick={handleSavePayment} className="btn-primary text-sm py-2 px-4">
                                                                            {editingPaymentId ? 'Update' : 'Add'}
                                                                        </button>
                                                                        {editingPaymentId && (
                                                                            <button onClick={resetPaymentForm} className="btn-secondary text-sm py-2 px-4">Cancel</button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Payments Table */}
                                                            {payments.length > 0 ? (
                                                                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                                                                    <table className="min-w-full divide-y divide-gray-200">
                                                                        <thead className="bg-gray-50">
                                                                            <tr>
                                                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                                                                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Amount</th>
                                                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Method</th>
                                                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Notes</th>
                                                                                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Actions</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="divide-y divide-gray-100 text-sm">
                                                                            {payments.map(p => (
                                                                                <tr key={p.id} className="hover:bg-gray-50">
                                                                                    <td className="px-4 py-2">{new Date(p.date).toLocaleDateString('en-US')}</td>
                                                                                    <td className="px-4 py-2 text-right">{formatEURDecimal(p.amount)}</td>
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
                                                                <p className="text-sm text-gray-400 text-center py-3">No payments yet</p>
                                                            )}
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
                </div>
            )}
        </div>
    );
};

export default Apartments;
