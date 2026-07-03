import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { smartCacheSet, smartCacheGet } from './cacheManager';
import { Icon } from '../assets/utils'; 
import './StudentList.css';

const PROTECTED_KEYS = ['authToken', 'studentSession'];
const COACHING_CITIES = ['Kota', 'Hyderabad', 'Delhi', 'Pune', 'Bangalore', 'Chennai', 'Mumbai', 'Jaipur', 'Patna', 'Chandigarh'];

const StudentList = () => {
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

    const [pageNumber, setPageNumber] = useState(() => {
        const savedPage = smartCacheGet('dashboard_pageNumber');
        return typeof savedPage === 'number' ? savedPage : 0;
    }); 
    const [pageSize] = useState(15);
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState(() => smartCacheGet('dashboard_filterType') || 'All');
    const [filterValue, setFilterValue] = useState(() => smartCacheGet('dashboard_filterValue') || '');

    useEffect(() => {
        smartCacheSet('dashboard_filterType', filterType);
        smartCacheSet('dashboard_filterValue', filterValue);
    }, [filterType, filterValue]);
    
    const [isAdding, setIsAdding] = useState(false);
    const [addFormData, setAddFormData] = useState({ name: '', rollNo: '', classNum: '', city: '', phone: '', role: 'STUDENT', smsOtpByPass: false });
    const [editingId, setEditingId] = useState(null);
    const [editFormData, setEditFormData] = useState({});

    const navigate = useNavigate();
    const getToken = () => sessionStorage.getItem('authToken');
    
    const flushStudentCache = () => {
        const backup = {};
        PROTECTED_KEYS.forEach(k => { if (sessionStorage.getItem(k)) backup[k] = sessionStorage.getItem(k); });
        sessionStorage.clear(); 
        Object.entries(backup).forEach(([k, v]) => sessionStorage.setItem(k, v));
        smartCacheSet('dashboard_filterType', filterType);
        smartCacheSet('dashboard_filterValue', filterValue);
    };

    const fetchStudents = useCallback((resetPage = false) => {
        setLoading(true);
        const currentPage = resetPage ? 0 : pageNumber;
        if (resetPage) setPageNumber(0);
        smartCacheSet('dashboard_pageNumber', currentPage);

        const cacheKey = `student_data_page_${currentPage}_${filterType}_${filterValue}`;
        const cachedData = smartCacheGet(cacheKey);
        if (cachedData) {
            setStudents(cachedData);
            setLoading(false);
            return; 
        }

        let url = `${API_BASE_URL}/api/students?pageNumber=${currentPage}&pageSize=${pageSize}`;
        if (filterType !== 'All' && filterValue.trim() !== '') {
            const queryParam = filterType === 'rollNumber' ? 'rollNumber' : filterType; 
            url += `&${queryParam}=${encodeURIComponent(filterValue)}`;
        }

        fetch(url, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${getToken()}`}
        })
        .then(res => res.ok ? res.json() : Promise.reject())
        .then(data => {
            setStudents(data);
            setLoading(false);
            smartCacheSet(cacheKey, data);
        })
        .catch(err => { console.error(err); setLoading(false); });
    }, [API_BASE_URL, pageNumber, pageSize, filterType, filterValue]);

    useEffect(() => { fetchStudents(); }, [pageNumber, fetchStudents]);

    const handleFilterApply = () => fetchStudents(true);

    const saveEdit = (id) => {
        fetch(`${API_BASE_URL}/api/students/${id}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json'},
            body: JSON.stringify(editFormData)
        }).then(res => { if(res.ok) { setEditingId(null); flushStudentCache(); fetchStudents(); } });
    };

    const saveNewStudent = () => {
        fetch(`${API_BASE_URL}/api/students`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json'},
            body: JSON.stringify(addFormData)
        }).then(res => { if(res.ok) { setIsAdding(false); setAddFormData({ name: '', rollNo: '', classNum: '', city: '', phone: '', role: 'STUDENT', smsOtpByPass: false }); flushStudentCache(); fetchStudents(true); } });
    };

    return (
        <div className="grid-dashboard-container">
            <div className="grid-header">
                <h2>Directory</h2>
                <button className="btn-success" onClick={() => setIsAdding(!isAdding)}>{isAdding ? 'Cancel Add' : '+ Add New User'}</button>
            </div>

            <div className="filter-bar">
                <div className="filter-group">
                    <label>Filter By:</label>
                    <select value={filterType} onChange={(e) => { setFilterType(e.target.value); setFilterValue(''); }}>
                        <option value="All">All</option>
                        <option value="name">Name</option>
                        <option value="city">City</option>
                        <option value="rollNumber">Roll Number</option>
                        <option value="role">Role</option>
                    </select>
                </div>
                {filterType === 'name' && <div className="filter-group"><input type="text" placeholder="Enter Name..." value={filterValue} onChange={(e) => setFilterValue(e.target.value)} /></div>}
                {filterType === 'city' && (
                    <div className="filter-group">
                        <input list="city-options" placeholder="Search city..." value={filterValue} onChange={(e) => setFilterValue(e.target.value)} />
                        <datalist id="city-options">{COACHING_CITIES.map(c => <option key={c} value={c} />)}</datalist>
                    </div>
                )}
                {filterType === 'rollNumber' && <div className="filter-group"><input type="text" placeholder="Enter Roll Number..." value={filterValue} onChange={(e) => setFilterValue(e.target.value)} /></div>}
                {filterType === 'role' && (
                    <div className="filter-group">
                        <select value={filterValue} onChange={(e) => setFilterValue(e.target.value)}>
                            <option value="" disabled>Select Role...</option>
                            <option value="STUDENT">Student</option>
                            <option value="ADMIN">Admin</option>
                        </select>
                    </div>
                )}
                <button className="btn-filter" onClick={handleFilterApply} title="Apply Filter"><Icon name="filter" size={18} /> Filter</button>
            </div>

            {loading ? (
                <div className="status-message loading-status"><div className="spinner"></div><span>Loading directory...</span></div>
            ) : (
                <div className="cards-grid">
                    {isAdding && (
                        <div className="student-card add-mode">
                            <div className="card-header"><h3>Add New</h3></div>
                            <div className="card-body edit-body">
                                <input name="name" placeholder="Full Name" value={addFormData.name} onChange={(e) => setAddFormData({...addFormData, name: e.target.value})} />
                                <input name="rollNo" placeholder="Roll Number" value={addFormData.rollNo} onChange={(e) => setAddFormData({...addFormData, rollNo: e.target.value})} />
                                <input name="classNum" placeholder="Class" type="number" value={addFormData.classNum} onChange={(e) => setAddFormData({...addFormData, classNum: e.target.value})} />
                                <input list="city-options" name="city" placeholder="City" value={addFormData.city} onChange={(e) => setAddFormData({...addFormData, city: e.target.value})} />
                                <input name="phone" placeholder="Phone" value={addFormData.phone} onChange={(e) => setAddFormData({...addFormData, phone: e.target.value})} />
                                <select name="role" value={addFormData.role} onChange={(e) => setAddFormData({...addFormData, role: e.target.value})}>
                                    <option value="STUDENT">Student</option><option value="ADMIN">Admin</option>
                                </select>
                                <div className="toggle-switch-container">
                                    <span className="toggle-switch-label">Bypass SMS OTP</span>
                                    <label className="toggle-switch"><input type="checkbox" name="smsOtpByPass" checked={addFormData.smsOtpByPass} onChange={(e) => setAddFormData({...addFormData, smsOtpByPass: e.target.checked})} /><span className="toggle-slider"></span></label>
                                </div>
                                <button className="btn-primary full-width" onClick={saveNewStudent}>Save Student</button>
                            </div>
                        </div>
                    )}
                    {students.map((student) => (
                        <div className="student-card" key={student.id}>
                            {editingId === student.id ? (
                                <>
                                    <div className="card-header"><input className="edit-title" name="name" value={editFormData.name} onChange={(e) => setEditFormData({...editFormData, name: e.target.value})} /></div>
                                    <div className="card-body edit-body">
                                        <input name="rollNo" value={editFormData.rollNo} onChange={(e) => setEditFormData({...editFormData, rollNo: e.target.value})} placeholder="Roll No" />
                                        <input name="classNum" value={editFormData.classNum} onChange={(e) => setEditFormData({...editFormData, classNum: e.target.value})} placeholder="Class" />
                                        <input name="city" value={editFormData.city} onChange={(e) => setEditFormData({...editFormData, city: e.target.value})} placeholder="City" />
                                        <input name="phone" value={editFormData.phone} onChange={(e) => setEditFormData({...editFormData, phone: e.target.value})} placeholder="Phone" />
                                        <select name="role" value={editFormData.role} onChange={(e) => setEditFormData({...editFormData, role: e.target.value})}>
                                    <option value="STUDENT">Student</option><option value="ADMIN">Admin</option>
                                </select>
                                <div className="toggle-switch-container">
                                    <span className="toggle-switch-label">Bypass SMS OTP</span>
                                    <label className="toggle-switch"><input type="checkbox" name="smsOtpByPass" checked={editFormData.smsOtpByPass} onChange={(e) => setEditFormData({...editFormData, smsOtpByPass: e.target.checked})} /><span className="toggle-slider"></span></label>
                                </div>
                                        <button className="btn-success full-width" onClick={() => saveEdit(student.id)}>Save Changes</button>
                                        <button className="btn-secondary full-width" onClick={() => setEditingId(null)}>Cancel</button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="card-header"><h3>{student.name}</h3><button className="btn-edit" onClick={() => { setEditingId(student.id); setEditFormData({...student}); }}>✎</button></div>
                                    <div className="card-body">
                                        <p><strong>Roll No:</strong> {student.rollNo}</p>
                                        <p><strong>City:</strong> {student.city}</p>
                                        <span className={`role-badge ${student.role === 'ADMIN' ? 'admin' : ''}`}>{student.role}</span>
                                    </div>
                                    <div className="card-footer">
                                        {student.role === 'STUDENT' && <button className="btn-primary" onClick={() => navigate(`/student/${student.id}/report`)}>View Report</button>}
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            )}
            <div className="pagination-controls">
                <button className="btn-secondary" disabled={pageNumber === 0} onClick={() => setPageNumber(prev => prev - 1)}><Icon name="chevronLeft" size={14} /> Prev</button>
                <span className="page-indicator">Page {pageNumber + 1}</span>
                <button className="btn-secondary" disabled={students.length < pageSize} onClick={() => setPageNumber(prev => prev + 1)}>Next <Icon name="chevronRight" size={14} /></button>
            </div>
        </div>
    );
};

export default StudentList;