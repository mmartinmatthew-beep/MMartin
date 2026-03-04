import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { postsAPI, subscriptionsAPI, creatorsAPI } from '../services/api';

export default function Dashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState('posts');
  const [posts, setPosts] = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  const [mySubscriptions, setMySubscriptions] = useState([]);
  const [feed, setFeed] = useState([]);
  const [tiers, setTiers] = useState([]);
  const [newTier, setNewTier] = useState({ name: '', description: '', price_cents: '', benefits: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const promises = [
      subscriptionsAPI.mine().then((r) => setMySubscriptions(r.data)),
      postsAPI.feed().then((r) => setFeed(r.data)),
    ];

    if (user.is_creator) {
      promises.push(
        postsAPI.byCreator(user.username).then((r) => setPosts(r.data)),
        subscriptionsAPI.subscribers().then((r) => setSubscribers(r.data)),
      );
    }

    Promise.all(promises).finally(() => setLoading(false));
  }, [user]);

  async function handleCreateTier(e) {
    e.preventDefault();
    try {
      const benefits = newTier.benefits.split('\n').map((b) => b.trim()).filter(Boolean);
      await subscriptionsAPI.createTier({ ...newTier, price_cents: parseInt(newTier.price_cents), benefits });
      alert('Tier created!');
      setNewTier({ name: '', description: '', price_cents: '', benefits: '' });
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create tier');
    }
  }

  if (!user) return <div style={{ textAlign: 'center', padding: '3rem' }}>Please log in.</div>;
  if (loading) return <div style={{ textAlign: 'center', padding: '3rem' }}>Loading...</div>;

  const tabs = [
    { id: 'feed', label: 'My Feed' },
    { id: 'subscriptions', label: 'Subscriptions' },
    ...(user.is_creator ? [
      { id: 'posts', label: 'My Posts' },
      { id: 'subscribers', label: 'Subscribers' },
      { id: 'tiers', label: 'Tiers' },
    ] : [{ id: 'become-creator', label: 'Become a Creator' }]),
  ];

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '1.5rem 1rem' }}>
      <h1 style={{ marginBottom: '1.5rem' }}>Dashboard</h1>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: '0.4rem 1rem', border: 'none', borderRadius: 6, cursor: 'pointer', background: tab === t.id ? '#4f46e5' : 'transparent', color: tab === t.id ? '#fff' : '#374151', fontWeight: tab === t.id ? 600 : 400 }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Feed */}
      {tab === 'feed' && (
        <div>
          {feed.length === 0 ? <p style={{ color: '#888' }}>Subscribe to creators to see their posts here.</p> : null}
          {feed.map((post) => (
            <div key={post.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '1rem', marginBottom: '1rem' }}>
              <Link to={`/creator/${post.username}`} style={{ color: '#4f46e5', fontSize: '0.85rem', textDecoration: 'none' }}>@{post.username}</Link>
              <h3 style={{ margin: '0.25rem 0' }}><Link to={`/post/${post.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>{post.title}</Link></h3>
              <p style={{ color: '#555', margin: 0, fontSize: '0.9rem' }}>{post.body?.slice(0, 150)}...</p>
            </div>
          ))}
        </div>
      )}

      {/* My Subscriptions */}
      {tab === 'subscriptions' && (
        <div>
          {mySubscriptions.length === 0 ? <p style={{ color: '#888' }}>No active subscriptions.</p> : null}
          {mySubscriptions.map((sub) => (
            <div key={sub.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '1rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Link to={`/creator/${sub.username}`} style={{ fontWeight: 700, textDecoration: 'none', color: '#374151' }}>{sub.display_name}</Link>
                <div style={{ color: '#888', fontSize: '0.85rem' }}>{sub.tier_name} &mdash; ${(sub.price_cents / 100).toFixed(2)}/mo</div>
                <div style={{ color: '#888', fontSize: '0.8rem' }}>Renews {new Date(sub.current_period_end).toLocaleDateString()}</div>
              </div>
              <button onClick={() => subscriptionsAPI.cancel(sub.id).then(() => setMySubscriptions((p) => p.filter((s) => s.id !== sub.id)))}
                style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '0.4rem 0.75rem', borderRadius: 6, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Creator: posts */}
      {tab === 'posts' && user.is_creator && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0 }}>Your Posts</h2>
            <Link to="/new-post" style={{ background: '#4f46e5', color: '#fff', padding: '0.5rem 1rem', borderRadius: 6, textDecoration: 'none' }}>+ New Post</Link>
          </div>
          {posts.length === 0 && <p style={{ color: '#888' }}>No posts yet. Create your first post!</p>}
          {posts.map((post) => (
            <div key={post.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '1rem', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>{post.title}</strong>
                <div style={{ color: '#888', fontSize: '0.8rem' }}>{post.view_count} views &middot; {post.like_count} likes &middot; {post.is_public ? 'Public' : 'Subscribers only'}</div>
              </div>
              <button onClick={() => postsAPI.delete(post.id).then(() => setPosts((p) => p.filter((pp) => pp.id !== post.id)))}
                style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '0.4rem 0.75rem', borderRadius: 6, cursor: 'pointer' }}>
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Creator: subscribers */}
      {tab === 'subscribers' && user.is_creator && (
        <div>
          <h2 style={{ marginTop: 0 }}>{subscribers.length} Active Subscriber{subscribers.length !== 1 ? 's' : ''}</h2>
          {subscribers.map((sub) => (
            <div key={sub.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
              <span>{sub.display_name} (@{sub.username})</span>
              <span style={{ color: '#888', fontSize: '0.85rem' }}>{sub.tier_name} &mdash; ${(sub.price_cents / 100).toFixed(2)}/mo</span>
            </div>
          ))}
        </div>
      )}

      {/* Creator: tiers */}
      {tab === 'tiers' && user.is_creator && (
        <div>
          <h2 style={{ marginTop: 0 }}>Create a Subscription Tier</h2>
          <form onSubmit={handleCreateTier} style={{ background: '#f9fafb', borderRadius: 10, padding: '1.5rem', maxWidth: 500 }}>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>Tier Name</label>
            <input required value={newTier.name} onChange={(e) => setNewTier((p) => ({ ...p, name: e.target.value }))}
              style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid #ddd', marginBottom: '1rem', boxSizing: 'border-box' }} />
            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>Monthly Price (cents, min 100)</label>
            <input required type="number" min="100" value={newTier.price_cents} onChange={(e) => setNewTier((p) => ({ ...p, price_cents: e.target.value }))}
              placeholder="500 = $5.00"
              style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid #ddd', marginBottom: '1rem', boxSizing: 'border-box' }} />
            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>Description</label>
            <textarea value={newTier.description} onChange={(e) => setNewTier((p) => ({ ...p, description: e.target.value }))}
              rows={2} style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid #ddd', marginBottom: '1rem', boxSizing: 'border-box' }} />
            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>Benefits (one per line)</label>
            <textarea value={newTier.benefits} onChange={(e) => setNewTier((p) => ({ ...p, benefits: e.target.value }))}
              rows={3} placeholder="Early access to videos&#10;Monthly Q&A&#10;Behind-the-scenes content"
              style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid #ddd', marginBottom: '1rem', boxSizing: 'border-box' }} />
            <button type="submit" style={{ background: '#4f46e5', color: '#fff', border: 'none', padding: '0.6rem 1.5rem', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
              Create Tier
            </button>
          </form>
        </div>
      )}

      {/* Become a creator */}
      {tab === 'become-creator' && !user.is_creator && (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <h2>Start Your Creator Journey</h2>
          <p style={{ color: '#555', maxWidth: 500, margin: '0 auto 1.5rem' }}>
            Create subscription tiers, post videos and articles, and build a direct relationship with your audience.
            We take only 8% — the rest goes to you.
          </p>
          <button onClick={() => creatorsAPI.becomeCreator().then(() => window.location.reload())}
            style={{ background: '#4f46e5', color: '#fff', border: 'none', padding: '0.75rem 2rem', borderRadius: 8, cursor: 'pointer', fontSize: '1rem', fontWeight: 600 }}>
            Activate Creator Account
          </button>
        </div>
      )}
    </div>
  );
}
