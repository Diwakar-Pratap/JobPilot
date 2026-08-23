import re

with open('frontend/app/dashboard/jobs/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add locationFilter state
content = content.replace(
    "const [search, setSearch] = useState('');",
    "const [search, setSearch] = useState('');\n  const [locationFilter, setLocationFilter] = useState('');"
)

# 2. Add locationFilter to fetchJobs params
fetch_jobs_orig = '''    if (search) params.append('q', search);'''
fetch_jobs_new = '''    if (search) params.append('q', search);
    if (locationFilter) params.append('location', locationFilter);'''
content = content.replace(fetch_jobs_orig, fetch_jobs_new)

# 3. Add locationFilter to fetchJobs dependencies
content = content.replace(
    "}, [page, search, workMode, jobType, experience, sortBy, activeRoleFilter]);",
    "}, [page, search, locationFilter, workMode, jobType, experience, sortBy, activeRoleFilter]);"
)

# 4. Add handleExportFilteredJobs function
export_func = '''
  const handleExportFilteredJobs = async () => {
    const token = getToken();
    const params = new URLSearchParams();
    if (search) params.append('q', search);
    if (locationFilter) params.append('location', locationFilter);
    if (workMode) params.append('work_mode', workMode);
    if (jobType) params.append('job_type', jobType);
    if (experience) params.append('experience', experience);
    if (sortBy) params.append('sort', sortBy);
    if (activeRoleFilter && activeRoleFilter !== 'all') {
      params.append('role', activeRoleFilter);
    }

    try {
      showToast('⏳ Generating Excel...');
      const res = await fetch(`${API}/api/jobs/export-filtered?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'filtered_jobs.xlsx';
        document.body.appendChild(a);
        a.click();
        a.remove();
        showToast('✅ Excel export downloaded!');
      } else {
        showToast('❌ Failed to export Excel');
      }
    } catch (e) {
      showToast('❌ Network error during export');
    }
  };
'''
content = content.replace(
    "  const handleSave = async (jobId: string) => {",
    export_func + "\n  const handleSave = async (jobId: string) => {"
)

# 5. Add Location input UI next to Search input
search_ui = '''            <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
              <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', color: '#4a5480' }}>🔍</span>
              <input
                id="job-search"
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="input-field"
                style={{ paddingLeft: '40px' }}
                placeholder="Search by role, company, or skill..."
              />
            </div>'''
location_ui = '''
            <div style={{ position: 'relative', flex: 0.5, minWidth: '150px' }}>
              <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', color: '#4a5480' }}>📍</span>
              <input
                id="job-location"
                type="text"
                value={locationFilter}
                onChange={e => { setLocationFilter(e.target.value); setPage(1); }}
                className="input-field"
                style={{ paddingLeft: '40px' }}
                placeholder="Location..."
              />
            </div>'''
content = content.replace(search_ui, search_ui + location_ui)

# 6. Update reset button to clear locationFilter
content = content.replace(
    "setSearch(''); setWorkMode('');",
    "setSearch(''); setLocationFilter(''); setWorkMode('');"
)

# 7. Add Export button next to reset button
reset_button = '''            <button onClick={() => { setSearch(''); setLocationFilter(''); setWorkMode(''); setJobType(''); setExperience(''); setSortBy('newest'); setActiveRoleFilter('all'); setPage(1); }}
              style={{
                padding: '8px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: 500,
                background: 'rgba(255,255,255,0.04)', color: '#4a5480',
                border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer',
              }}>
              Reset
            </button>'''

export_button = '''
            <button onClick={handleExportFilteredJobs}
              style={{
                padding: '8px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: 600,
                background: 'rgba(16, 185, 129, 0.1)', color: '#10b981',
                border: '1px solid rgba(16, 185, 129, 0.2)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px'
              }}>
              📊 Export Excel
            </button>'''
            
content = content.replace(reset_button, reset_button + export_button)

with open('frontend/app/dashboard/jobs/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Frontend patch applied successfully!")

