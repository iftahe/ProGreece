import React, { useState, useEffect } from 'react';
import { getProjects, createProject, updateProject } from '../api';
import { PencilIcon, EmptyStateIcon } from '../components/Icons';
import { cn, formatEUR } from '../lib/utils';

const statusConfig = {
    Active: { dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' },
    Completed: { dot: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-50' },
    Archived: { dot: 'bg-gray-400', text: 'text-gray-600', bg: 'bg-gray-100' },
};

const StatusBadge = ({ status }) => {
    const config = statusConfig[status] || statusConfig.Archived;
    return (
        <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', config.bg, config.text)}>
            <span className={cn('w-1.5 h-1.5 rounded-full', config.dot)} />
            {status}
        </span>
    );
};

const SkeletonProjects = () => (
    <div className="space-y-6">
        <div className="card p-6 space-y-4">
            <div className="skeleton h-6 w-32" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="space-y-2">
                        <div className="skeleton h-4 w-24" />
                        <div className="skeleton h-10 w-full rounded-lg" />
                    </div>
                ))}
            </div>
        </div>
        <div className="card overflow-hidden">
            <div className="px-6 py-4">
                <div className="skeleton h-6 w-28" />
            </div>
            <div className="px-6 space-y-3 pb-6">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="skeleton h-12 w-full rounded" />
                ))}
            </div>
        </div>
    </div>
);

const Projects = () => {
    const [projects, setProjects] = useState([]);
    const [initialLoading, setInitialLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [message, setMessage] = useState(null);

    const initialFormState = {
        name: '',
        status: 'Active',
        total_budget: '',
        remarks: ''
    };
    const [formData, setFormData] = useState(initialFormState);

    useEffect(() => {
        loadProjects();
    }, []);

    const loadProjects = async () => {
        try {
            const data = await getProjects();
            setProjects(data);
        } catch (error) {
            console.error("Failed to load projects", error);
            setMessage({ type: 'error', text: 'Failed to load projects' });
        } finally {
            setInitialLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);

        try {
            const payload = {
                ...formData,
                total_budget: formData.total_budget ? parseFloat(formData.total_budget) : null
            };

            if (editingId) {
                await updateProject(editingId, payload);
                setMessage({ type: 'success', text: 'Project updated successfully' });
            } else {
                await createProject(payload);
                setMessage({ type: 'success', text: 'Project created successfully' });
            }

            resetForm();
            loadProjects();
        } catch (error) {
            console.error(error);
            setMessage({ type: 'error', text: 'Failed to save project' });
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (project) => {
        setEditingId(project.id);
        setFormData({
            name: project.name,
            status: project.status || 'Active',
            total_budget: project.total_budget || '',
            remarks: project.remarks || ''
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const resetForm = () => {
        setEditingId(null);
        setFormData(initialFormState);
    };

    if (initialLoading) return <SkeletonProjects />;

    return (
        <div className="space-y-6">
            {/* Form Section */}
            <div className="card p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">
                        {editingId ? 'Edit Project' : 'New Project'}
                    </h2>
                    {editingId && (
                        <button onClick={resetForm} className="text-sm text-rose-600 hover:text-rose-800 font-medium">
                            Cancel Edit
                        </button>
                    )}
                </div>

                {message && (
                    <div className={cn(
                        'p-4 mb-4 rounded-lg text-sm font-medium',
                        message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                    )}>
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <fieldset className="space-y-4">
                        <legend className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Project Details</legend>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Project Name</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    required
                                    className="input-field"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Total Budget</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    name="total_budget"
                                    value={formData.total_budget}
                                    onChange={handleChange}
                                    className="input-field"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Status</label>
                                <select
                                    name="status"
                                    value={formData.status}
                                    onChange={handleChange}
                                    className="input-field"
                                >
                                    <option value="Active">Active</option>
                                    <option value="Completed">Completed</option>
                                    <option value="Archived">Archived</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Remarks</label>
                                <input
                                    type="text"
                                    name="remarks"
                                    value={formData.remarks}
                                    onChange={handleChange}
                                    className="input-field"
                                />
                            </div>
                        </div>
                    </fieldset>

                    <div className="flex justify-end pt-2">
                        <button
                            type="submit"
                            disabled={saving}
                            className={cn(
                                'inline-flex justify-center py-2.5 px-6 text-sm font-semibold rounded-lg text-white shadow-sm transition-colors',
                                editingId
                                    ? 'bg-amber-600 hover:bg-amber-700'
                                    : 'bg-primary-600 hover:bg-primary-700',
                                saving && 'opacity-50 cursor-not-allowed'
                            )}
                        >
                            {saving ? 'Saving...' : (editingId ? 'Update Project' : 'Create Project')}
                        </button>
                    </div>
                </form>
            </div>

            {/* Projects Table */}
            <div className="card overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900">All Projects</h3>
                </div>

                {projects.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4">
                        <EmptyStateIcon className="w-16 h-16 text-gray-300 mb-4" />
                        <p className="text-gray-500 text-sm">No projects yet. Create your first project above.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Budget</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Remarks</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm">
                                {projects.map((p, index) => (
                                    <tr key={p.id} className={cn("hover:bg-gray-50", index % 2 !== 0 && "bg-slate-50/50")}>
                                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{p.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <StatusBadge status={p.status} />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-gray-900 font-medium">
                                            {p.total_budget ? formatEUR(p.total_budget) : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 max-w-xs truncate">{p.remarks}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <button
                                                onClick={() => handleEdit(p)}
                                                className="inline-flex items-center p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                                                title="Edit project"
                                            >
                                                <PencilIcon className="w-4 h-4" />
                                            </button>
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

export default Projects;
