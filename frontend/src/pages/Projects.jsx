import React, { useState, useEffect } from 'react';
import { getProjects, createProject, updateProject } from '../api';

const Projects = () => {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(false);
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
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
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
            setLoading(false);
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

    return (
        <div className="max-w-6xl mx-auto bg-white p-8 rounded-lg shadow space-y-12">

            {/* Form Section */}
            <div>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">
                        {editingId ? 'Edit Project' : 'New Project'}
                    </h2>
                    {editingId && (
                        <button onClick={resetForm} className="text-sm text-red-600 hover:text-red-800 underline">
                            Cancel Edit
                        </button>
                    )}
                </div>

                {message && (
                    <div className={`p-4 mb-4 rounded ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6 border-b pb-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Project Name</label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                required
                                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm border p-2"
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
                                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm border p-2"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Status</label>
                            <select
                                name="status"
                                value={formData.status}
                                onChange={handleChange}
                                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm border p-2"
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
                                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm border p-2"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={loading}
                            className={`inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${editingId ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'
                                }`}
                        >
                            {loading ? 'Saving...' : (editingId ? 'Update Project' : 'Create Project')}
                        </button>
                    </div>
                </form>
            </div>

            {/* List Section */}
            <div>
                <h3 className="text-xl font-bold mb-4 text-gray-800">All Projects</h3>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Budget</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Remarks</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {projects.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-4 text-center text-gray-500">No projects found.</td>
                                </tr>
                            ) : (
                                projects.map(p => (
                                    <tr key={p.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{p.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.status}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {p.total_budget ? Number(p.total_budget).toLocaleString() + ' ₪' : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">{p.remarks}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button onClick={() => handleEdit(p)} className="text-indigo-600 hover:text-indigo-900">
                                                Edit
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Projects;
