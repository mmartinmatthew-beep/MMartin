import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { creatorsAPI } from '../services/api';

const CATEGORIES = ['all', 'education', 'news', 'fitness', 'gaming', 'music', 'comedy', 'technology', 'art', 'politics', 'science'];

export default function Home() {
  const [creators, setCreators] = useState([]);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    creatorsAPI.list({ category: category === 'all' ? undefined : category, search: search || undefined })
      .then((res) => setCreators(res.data))
      .finally(() => setLoading(false));
  }, [category, search]);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Support Independent Creators</h1>
        <p style={{ color: '#666', fontSize: '1.1rem' }}>
          No arbitrary bans. Transparent policies. Your subscription goes directly to creators.
        </p>
        <div style={{ marginTop: '1rem' }}>
          <Link to="/policy" style={{ color: '#4f46e5', marginRight: '1rem' }}>View Content Policy</Link>
          <Link to="/register" style={{ background: '#4f46e5', color: '#fff', padding: '0.5rem 1.5rem', borderRadius: 6, textDecoration: 'none' }}>
            Start Creating
          </Link>
        </div>
      </div>

      {/* Search + filter */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search creators..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200, padding: '0.5rem 1rem', borderRadius: 6, border: '1px solid #ddd', fontSize: '1rem' }}
        />
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              style={{
                padding: '0.4rem 1rem',
                borderRadius: 20,
                border: 'none',
                cursor: 'pointer',
                background: category === cat ? '#4f46e5' : '#f3f4f6',
                color: category === cat ? '#fff' : '#374151',
                fontWeight: category === cat ? 600 : 400,
              }}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Creator grid */}
      {loading ? (
        <p style={{ textAlign: 'center', color: '#888' }}>Loading creators...</p>
      ) : creators.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#888' }}>No creators found.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.5rem' }}>
          {creators.map((creator) => (
            <Link
              key={creator.id}
              to={`/creator/${creator.username}`}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #e5e7eb', background: '#fff', transition: 'box-shadow 0.2s', cursor: 'pointer' }}
                   onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.1)'}
                   onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}>
                <div style={{
                  height: 100,
                  background: creator.cover_image_url ? `url(${creator.cover_image_url}) center/cover` : '#4f46e5',
                }} />
                <div style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: '50%',
                      background: creator.avatar_url ? `url(${creator.avatar_url}) center/cover` : '#e0e7ff',
                      border: '2px solid #fff',
                      marginTop: -28,
                      flexShrink: 0,
                    }} />
                    <div>
                      <div style={{ fontWeight: 700 }}>{creator.display_name}</div>
                      <div style={{ color: '#888', fontSize: '0.85rem' }}>@{creator.username}</div>
                    </div>
                  </div>
                  {creator.tagline && <p style={{ color: '#374151', fontSize: '0.9rem', marginBottom: '0.5rem' }}>{creator.tagline}</p>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#888', fontSize: '0.8rem' }}>
                    <span>{creator.subscriber_count?.toLocaleString() || 0} subscribers</span>
                    {creator.category && <span style={{ background: '#f3f4f6', padding: '0.15rem 0.5rem', borderRadius: 10 }}>{creator.category}</span>}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
