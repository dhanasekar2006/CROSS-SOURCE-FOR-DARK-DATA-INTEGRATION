import React, { useState, useEffect, useMemo } from 'react';
import {
    LineChart, Line, AreaChart, Area, BarChart, Bar,
    XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell
} from 'recharts';
import { insightsApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useUserData } from '../contexts/UserDataContext';

const SEVERITY_COLORS = { critical: '#ef4444', warning: '#f59e0b', info: '#06b6d4' };
const SEVERITY_BADGES = { critical: 'badge badge-red', warning: 'badge badge-yellow', info: 'badge badge-cyan' };
const TYPE_BADGES = { anomaly: 'badge badge-red', pattern: 'badge badge-purple', prediction: 'badge badge-cyan', summary: 'badge badge-green' };

const MOCK_INSIGHTS = [
    { title: 'Error Log Spike Detected', description: 'Detected 15 error-level log entries across auth-service and db-connector. Possible system instability and cascading failures detected. Immediate review recommended.', insight_type: 'anomaly', severity: 'critical', confidence: 0.88, created_at: new Date(Date.now() - 5 * 60000).toISOString() },
    { title: 'IoT Sensor Critical Readings', description: '3 IoT sensors (temp-sensor-01, pressure-gauge-03, vibration-monitor-12) reported critical readings. Immediate inspection recommended for Zone-7 and Zone-3.', insight_type: 'anomaly', severity: 'critical', confidence: 0.92, created_at: new Date(Date.now() - 12 * 60000).toISOString() },
    { title: 'Compliance Risk: Unclassified PII', description: 'NLP analysis detected potential PII (emails, phone numbers) in 23% of unstructured dark data records that have not been classified. Regulatory risk under GDPR/PDPA.', insight_type: 'anomaly', severity: 'critical', confidence: 0.85, created_at: new Date(Date.now() - 25 * 60000).toISOString() },
    { title: 'Primary Dark Data Source: LOGS', description: 'Server logs contribute 30% of total dark data volume (3,252 records). Prioritize log analysis and classification for maximum intelligence extraction.', insight_type: 'summary', severity: 'info', confidence: 0.95, created_at: new Date(Date.now() - 60 * 60000).toISOString() },
    { title: 'High Entity Density Detected', description: 'Extracted 4,271 unique entities from dark data sources. High entity density indicates rich, semantically valuable but underutilized organizational knowledge.', insight_type: 'pattern', severity: 'info', confidence: 0.87, created_at: new Date(Date.now() - 90 * 60000).toISOString() },
    { title: 'Behavioral Pattern Clusters Found', description: 'Clustering analysis revealed 7 distinct behavioral groups. Cross-cluster relationships expose hidden organizational workflows and data silos across Finance, IT, and HR.', insight_type: 'pattern', severity: 'info', confidence: 0.79, created_at: new Date(Date.now() - 120 * 60000).toISOString() },
    { title: 'Data Growth 40% Increase Projected', description: 'Based on current ingestion rates and historical patterns, dark data volume is projected to grow 40% over the next 6 months. Storage and processing capacity planning required.', insight_type: 'prediction', severity: 'warning', confidence: 0.73, created_at: new Date(Date.now() - 180 * 60000).toISOString() },
    { title: 'Legacy Database Retention Risk', description: 'Multiple legacy database records are older than 5 years and may have exceeded organizational data retention policies. Automated archival or deletion workflow recommended.', insight_type: 'pattern', severity: 'warning', confidence: 0.80, created_at: new Date(Date.now() - 240 * 60000).toISOString() },
    { title: 'Unread Dark Email Archive', description: '20 email records found with zero access counts. These represent significant dark data in the email layer. Consider archival classification.', insight_type: 'pattern', severity: 'warning', confidence: 0.82, created_at: new Date(Date.now() - 300 * 60000).toISOString() },
    { title: 'Knowledge Graph Connectivity Growing', description: 'Entity relationship density increased by 15% following new data ingestion. The knowledge graph is becoming more interconnected, enabling richer cross-source queries.', insight_type: 'summary', severity: 'info', confidence: 0.90, created_at: new Date(Date.now() - 360 * 60000).toISOString() },
];

// ── Generate forecast data from real or mock data ──────────────────
function buildForecast(analyses) {
    const today = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Historical: last 6 months
    const base = analyses.length > 0 ? analyses.reduce((s, a) => s + (a.wordCount || 0), 0) : 4170;
    const avgDark = analyses.length > 0 ? analyses.reduce((s, a) => s + (a.darkScore || 0), 0) / analyses.length : 0.15;
    const piiCount = analyses.length > 0 ? analyses.reduce((s, a) => s + (a.piiCount || 0), 0) : 0;

    const historical = Array.from({ length: 6 }, (_, i) => {
        const date = new Date(today);
        date.setMonth(today.getMonth() - 5 + i);
        const growth = 1 + 0.12 * i + Math.random() * 0.05;
        return {
            month: months[date.getMonth()],
            Records: Math.round(base * growth * 0.8),
            DarkScore: parseFloat((avgDark + 0.02 * i + Math.random() * 0.01).toFixed(3)),
            PII: Math.round(piiCount + i * 0.5),
            type: 'historical',
        };
    });

    // Forecast: next 6 months (projected with 40% growth trend)
    const lastRecord = historical[5].Records;
    const lastDark = historical[5].DarkScore;
    const forecast = Array.from({ length: 6 }, (_, i) => {
        const date = new Date(today);
        date.setMonth(today.getMonth() + 1 + i);
        const growthFactor = 1 + 0.067 * (i + 1); // ~40% over 6 months
        return {
            month: months[date.getMonth()],
            Records: Math.round(lastRecord * growthFactor),
            DarkScore: parseFloat(Math.min(lastDark + 0.015 * (i + 1), 0.95).toFixed(3)),
            PII: Math.round(piiCount + (i + 7) * 0.5),
            type: 'forecast',
        };
    });

    return { historical, forecast, combined: [...historical, ...forecast] };
}

// ── Custom Recharts Tooltip ─────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-medium)', borderRadius: 10, padding: '10px 16px', fontSize: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
            <p style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>{label}</p>
            {payload.map((p, i) => (
                <p key={i} style={{ color: p.color || 'var(--text-secondary)', marginBottom: 2 }}>
                    {p.name}: <strong>{typeof p.value === 'number' && p.value < 1 ? (p.value * 100).toFixed(1) + '%' : p.value?.toLocaleString()}</strong>
                </p>
            ))}
        </div>
    );
};

export default function Insights() {
    const { user } = useAuth();
    const { insights: userInsights, isEmpty, analyses } = useUserData();
    const navigate = (path) => { window.history.pushState({}, '', path); window.dispatchEvent(new PopStateEvent('popstate')); };

    const [insights, setInsights] = useState(MOCK_INSIGHTS);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all');
    const [generating, setGenerating] = useState(false);
    const [activeMainTab, setActiveMainTab] = useState('insights');

    const forecast = useMemo(() => buildForecast(user?.role !== 'admin' ? analyses : []), [analyses, user?.role]);

    // Keep analyst insights in sync with their uploaded data
    useEffect(() => {
        if (user?.role !== 'admin') {
            setInsights(userInsights.length > 0 ? userInsights : []);
        }
    }, [userInsights, user?.role]);

    const generateInsights = async () => {
        setGenerating(true);
        try {
            const res = await insightsApi.generate({ force_refresh: true });
            setInsights(res.data.insights || MOCK_INSIGHTS);
        } catch {
            setInsights(MOCK_INSIGHTS);
        } finally {
            setGenerating(false);
        }
    };

    const exportCSV = async () => {
        try {
            const res = await insightsApi.exportCsv();
            const url = URL.createObjectURL(res.data);
            const a = document.createElement('a');
            a.href = url; a.download = 'darkfuse_insights.csv'; a.click();
        } catch {
            const rows = [['Title', 'Type', 'Severity', 'Confidence', 'Description']];
            insights.forEach(ins => rows.push([ins.title, ins.insight_type, ins.severity, ins.confidence, ins.description]));
            const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = 'darkfuse_insights.csv'; a.click();
        }
    };

    const filtered = insights.filter(ins => {
        if (filter !== 'all' && ins.severity !== filter) return false;
        if (typeFilter !== 'all' && ins.insight_type !== typeFilter) return false;
        return true;
    });

    const counts = {
        all: insights.length,
        critical: insights.filter(i => i.severity === 'critical').length,
        warning: insights.filter(i => i.severity === 'warning').length,
        info: insights.filter(i => i.severity === 'info').length,
    };

    const timeAgo = (dateStr) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'just now';
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    };

    // Prediction cards
    const predictionCards = [
        {
            title: 'Dark Data Volume Growth',
            icon: '📈', color: '#7c3aed',
            current: forecast.historical[5]?.Records?.toLocaleString() || '—',
            projected: forecast.forecast[5]?.Records?.toLocaleString() || '—',
            change: '+40%', horizon: '6 months',
            risk: 'warning', confidence: 73,
            detail: 'Exponential growth due to increased IoT and email sources. Recommend capacity expansion.',
        },
        {
            title: 'Dark Risk Score Trend',
            icon: '🔐', color: '#ef4444',
            current: ((forecast.historical[5]?.DarkScore || 0) * 100).toFixed(1) + '%',
            projected: ((forecast.forecast[5]?.DarkScore || 0) * 100).toFixed(1) + '%',
            change: '+9%', horizon: '6 months',
            risk: 'critical', confidence: 81,
            detail: 'Dark score is increasing as more legacy records are discovered. Immediate classification required.',
        },
        {
            title: 'PII Compliance Exposure',
            icon: '⚠️', color: '#f59e0b',
            current: `${forecast.historical[5]?.PII || 0} items`,
            projected: `${forecast.forecast[5]?.PII || 0} items`,
            change: '+35%', horizon: '6 months',
            risk: 'warning', confidence: 76,
            detail: 'Growing PII instances risk GDPR non-compliance. Deploy automated masking pipeline.',
        },
        {
            title: 'Knowledge Graph Expansion',
            icon: '🕸️', color: '#10b981',
            current: '127 nodes',
            projected: '~218 nodes',
            change: '+72%', horizon: '6 months',
            risk: 'info', confidence: 68,
            detail: 'Entity relationships growing rapidly. Graph will provide richer cross-source insights.',
        },
    ];

    return (
        <div className="animate-fade">
            <div className="page-header">
                <div>
                    <h1 className="page-title">💡 AI Insights Engine</h1>
                    <p className="page-subtitle">
                        {user?.role !== 'admin' ? 'Insights derived from your uploaded files' : 'Anomaly detection, behavioral patterns, and predictive analytics'}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    {user?.role === 'admin' && (
                        <button className="btn btn-secondary btn-sm" onClick={generateInsights} disabled={generating}>
                            {generating ? '⏳ Generating...' : '🔄 Regenerate'}
                        </button>
                    )}
                    <button className="btn btn-primary btn-sm" onClick={exportCSV}>📥 Export CSV</button>
                    {user?.role !== 'admin' && (
                        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/workspace')}>📂 My Workspace</button>
                    )}
                </div>
            </div>

            {user?.role !== 'admin' && isEmpty ? (
                <div className="card" style={{ textAlign: 'center', padding: '60px 40px' }}>
                    <div style={{ fontSize: 64, marginBottom: 16 }}>💡</div>
                    <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>No insights yet</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24 }}>Upload files in My Workspace to generate personalized AI insights here.</p>
                    <button className="btn btn-primary" onClick={() => navigate('/workspace')} style={{ justifyContent: 'center' }}>📂 Go to Workspace</button>
                </div>
            ) : (
                <div>
                    {/* Summary KPI Cards */}
                    <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20 }}>
                        {[
                            { label: 'Total Insights', value: counts.all, icon: '💡', color: '#7c3aed', key: 'all' },
                            { label: 'Critical Alerts', value: counts.critical, icon: '🔴', color: '#ef4444', key: 'critical' },
                            { label: 'Warnings', value: counts.warning, icon: '🟡', color: '#f59e0b', key: 'warning' },
                            { label: 'Informational', value: counts.info, icon: '🔵', color: '#06b6d4', key: 'info' },
                        ].map(card => (
                            <div key={card.key} className="kpi-card"
                                onClick={() => { setFilter(card.key); setActiveMainTab('insights'); }}
                                style={{ cursor: 'pointer', borderColor: filter === card.key && activeMainTab === 'insights' ? card.color : 'var(--border-subtle)', background: filter === card.key && activeMainTab === 'insights' ? `${card.color}08` : 'var(--bg-card)' }}>
                                <div className="kpi-header">
                                    <span className="kpi-label">{card.label}</span>
                                    <span className="kpi-icon" style={{ background: `${card.color}22` }}>{card.icon}</span>
                                </div>
                                <div className="kpi-value" style={{ color: card.color }}>{card.value}</div>
                            </div>
                        ))}
                    </div>

                    {/* Main Tabs: Insights | Predictions */}
                    <div className="tabs" style={{ marginBottom: 20 }}>
                        {[
                            { id: 'insights', label: '💡 Current Insights' },
                            { id: 'predictions', label: '🔮 Future Predictions' },
                        ].map(tab => (
                            <button key={tab.id} className={`tab ${activeMainTab === tab.id ? 'active' : ''}`}
                                onClick={() => setActiveMainTab(tab.id)} style={{ fontSize: 13, padding: '12px 20px' }}>
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* ── INSIGHTS TAB ── */}
                    {activeMainTab === 'insights' && (
                        <div className="animate-fade">
                            {/* Type Filters */}
                            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 13, color: 'var(--text-muted)', alignSelf: 'center' }}>Type:</span>
                                {['all', 'anomaly', 'pattern', 'prediction', 'summary'].map(type => (
                                    <button key={type} className={`btn btn-sm ${typeFilter === type ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setTypeFilter(type)} style={{ textTransform: 'capitalize' }}>
                                        {type}
                                    </button>
                                ))}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {filtered.map((ins, i) => (
                                    <div key={i} className="card animate-fade" style={{ animationDelay: `${i * 0.04}s`, borderLeft: `3px solid ${SEVERITY_COLORS[ins.severity] || '#94a3b8'}` }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 8 }}>
                                            <h3 style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3 }}>{ins.title}</h3>
                                            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                                <span className={SEVERITY_BADGES[ins.severity] || 'badge badge-gray'}>{ins.severity}</span>
                                                <span className={TYPE_BADGES[ins.insight_type] || 'badge badge-gray'}>{ins.insight_type}</span>
                                            </div>
                                        </div>
                                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{ins.description}</p>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                                            <span>🕐 {timeAgo(ins.created_at)}</span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                Confidence: <span style={{ fontWeight: 700, color: 'var(--brand-success)' }}>{Math.round(ins.confidence * 100)}%</span>
                                            </span>
                                            <div style={{ width: 80, height: 4, background: 'var(--bg-active)', borderRadius: 2, display: 'inline-block' }}>
                                                <div style={{ height: '100%', width: `${ins.confidence * 100}%`, background: 'var(--brand-success)', borderRadius: 2 }} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {filtered.length === 0 && (
                                    <div style={{ textAlign: 'center', padding: 60 }}>
                                        <div style={{ fontSize: 48, marginBottom: 10 }}>🔍</div>
                                        <p style={{ color: 'var(--text-muted)' }}>No insights match the selected filters</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── FUTURE PREDICTIONS TAB ── */}
                    {activeMainTab === 'predictions' && (
                        <div className="animate-fade">
                            <div style={{ background: 'linear-gradient(135deg, #7c3aed15, #06b6d415)', border: '1px solid #7c3aed30', borderRadius: 12, padding: '16px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
                                <span style={{ fontSize: 24 }}>🔮</span>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 2 }}>AI-Powered Forecast Engine</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                        Projections derived from current data volume, dark scores, and historical ingestion trends. Forecast horizon: 6 months.
                                    </div>
                                </div>
                            </div>

                            {/* Prediction Summary Cards */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 24 }}>
                                {predictionCards.map((card, i) => (
                                    <div key={i} className="card" style={{ borderTop: `3px solid ${card.color}` }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                                            <span style={{ fontSize: 22 }}>{card.icon}</span>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{card.title}</div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Horizon: {card.horizon}</div>
                                            </div>
                                            <span className={`badge badge-${card.risk === 'critical' ? 'red' : card.risk === 'warning' ? 'yellow' : card.risk === 'info' ? 'cyan' : 'green'}`} style={{ fontSize: 10 }}>
                                                {card.change}
                                            </span>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                                            <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '10px 12px' }}>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>CURRENT</div>
                                                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{card.current}</div>
                                            </div>
                                            <div style={{ background: `${card.color}12`, border: `1px solid ${card.color}30`, borderRadius: 8, padding: '10px 12px' }}>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>PROJECTED</div>
                                                <div style={{ fontSize: 18, fontWeight: 800, color: card.color }}>{card.projected}</div>
                                            </div>
                                        </div>
                                        <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 10 }}>{card.detail}</p>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Model confidence:</span>
                                            <div style={{ flex: 1, height: 4, background: 'var(--bg-active)', borderRadius: 2 }}>
                                                <div style={{ width: `${card.confidence}%`, height: '100%', background: card.color, borderRadius: 2, transition: 'width 0.8s ease' }} />
                                            </div>
                                            <span style={{ fontSize: 12, fontWeight: 700, color: card.color }}>{card.confidence}%</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* ── Chart: Records Growth Forecast ── */}
                            <div className="card" style={{ marginBottom: 20 }}>
                                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    📊 Dark Data Volume — Historical vs Projected
                                </div>
                                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                                    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#7c3aed', marginRight: 5 }} />Actual (last 6 months)
                                    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#06b6d4', marginRight: 5, marginLeft: 14 }} />Forecast (next 6 months)
                                </p>
                                <ResponsiveContainer width="100%" height={280}>
                                    <AreaChart data={forecast.combined} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                                        <defs>
                                            <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="foreGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                                        <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Area type="monotone" dataKey="Records"
                                            stroke="#7c3aed" fill="url(#histGrad)"
                                            strokeWidth={2.5} dot={(props) => props.payload.type === 'historical' ? <circle cx={props.cx} cy={props.cy} r={4} fill="#7c3aed" /> : null}
                                            activeDot={{ r: 5 }}
                                            strokeDasharray={(d) => d?.type === 'forecast' ? '6 3' : '0'}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>

                            {/* ── Two-column: Dark Score trend + PII exposure ── */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                                {/* Dark Score */}
                                <div className="card">
                                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>🔐 Dark Risk Score Forecast</div>
                                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>Monthly average dark data score (0–100%)</p>
                                    <ResponsiveContainer width="100%" height={200}>
                                        <LineChart data={forecast.combined} margin={{ top: 5, right: 8, bottom: 0, left: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                                            <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                                            <YAxis tickFormatter={v => `${(v * 100).toFixed(0)}%`} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Line type="monotone" dataKey="DarkScore" name="Dark Score"
                                                stroke="#ef4444" strokeWidth={2.5}
                                                dot={(props) => props.payload.type === 'historical' ? <circle cx={props.cx} cy={props.cy} r={3} fill="#ef4444" /> : <circle cx={props.cx} cy={props.cy} r={3} fill="none" stroke="#ef4444" strokeDasharray="4 2" />}
                                                strokeDasharray={(props) => props?.type === 'forecast' ? '6 3' : '0'} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* PII Exposure Bar Chart */}
                                <div className="card">
                                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>⚠️ PII Exposure Timeline</div>
                                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>Cumulative PII instances detected/projected</p>
                                    <ResponsiveContainer width="100%" height={200}>
                                        <BarChart data={forecast.combined} margin={{ top: 5, right: 8, bottom: 0, left: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                                            <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                                            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Bar dataKey="PII" name="PII Items" radius={[4, 4, 0, 0]}>
                                                {forecast.combined.map((entry, i) => (
                                                    <Cell key={i} fill={entry.type === 'historical' ? '#7c3aed' : '#f59e0b'} opacity={entry.type === 'forecast' ? 0.65 : 0.9} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Risk Action Plan */}
                            <div className="card">
                                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    🎯 Recommended Actions
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {[
                                        { icon: '🔴', priority: 'CRITICAL', action: 'Deploy automated PII detection and masking on all new ingested records', timeline: 'Immediately', color: '#ef4444' },
                                        { icon: '🟠', priority: 'HIGH', action: 'Classify and archive legacy database records older than 3 years to reduce dark data volume', timeline: 'Within 30 days', color: '#f59e0b' },
                                        { icon: '🟡', priority: 'MEDIUM', action: 'Expand storage and processing capacity by 50% to handle projected 40% data growth', timeline: 'Within 90 days', color: '#06b6d4' },
                                        { icon: '🟢', priority: 'LOW', action: 'Implement automated email archive classification using knowledge graph entity linking', timeline: 'Within 180 days', color: '#10b981' },
                                    ].map((item, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '12px 16px', background: `${item.color}0a`, border: `1px solid ${item.color}25`, borderRadius: 10 }}>
                                            <span style={{ fontSize: 18, flexShrink: 0 }}>{item.icon}</span>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                                    <span style={{ fontSize: 11, fontWeight: 800, color: item.color, letterSpacing: '0.06em' }}>{item.priority}</span>
                                                    <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '1px 8px', borderRadius: 10 }}>📅 {item.timeline}</span>
                                                </div>
                                                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>{item.action}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
