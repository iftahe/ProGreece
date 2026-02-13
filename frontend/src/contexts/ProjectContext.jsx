import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getProjects } from '../api';

const ProjectContext = createContext(null);

export const ProjectProvider = ({ children }) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);

    const projectIdFromUrl = searchParams.get('project');
    const selectedProjectId = projectIdFromUrl ? Number(projectIdFromUrl) : null;

    const loadProjects = useCallback(async () => {
        try {
            const data = await getProjects();
            setProjects(data);
            // Auto-select first project if none selected and projects exist
            if (!projectIdFromUrl && data.length > 0) {
                setSearchParams(prev => {
                    const next = new URLSearchParams(prev);
                    next.set('project', data[0].id.toString());
                    return next;
                }, { replace: true });
            }
        } catch (error) {
            console.error('Failed to load projects', error);
        } finally {
            setLoading(false);
        }
    }, [projectIdFromUrl, setSearchParams]);

    useEffect(() => {
        loadProjects();
    }, [loadProjects]);

    const selectProject = useCallback((projectId) => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            if (projectId) {
                next.set('project', projectId.toString());
            } else {
                next.delete('project');
            }
            return next;
        }, { replace: true });
    }, [setSearchParams]);

    const selectedProject = projects.find(p => p.id === selectedProjectId) || null;

    const refreshProjects = useCallback(async () => {
        const data = await getProjects();
        setProjects(data);
        return data;
    }, []);

    return (
        <ProjectContext.Provider value={{
            projects,
            selectedProjectId,
            selectedProject,
            selectProject,
            loading,
            refreshProjects,
        }}>
            {children}
        </ProjectContext.Provider>
    );
};

export const useProject = () => {
    const context = useContext(ProjectContext);
    if (!context) {
        throw new Error('useProject must be used within a ProjectProvider');
    }
    return context;
};
