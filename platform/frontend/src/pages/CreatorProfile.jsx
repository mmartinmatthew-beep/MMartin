import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { creatorsAPI, postsAPI, subscriptionsAPI } from '../services/api';
import { useAuth } from '../hooks/useAuth';

export default function CreatorProfile() {
  const { username } = useParams();
  const { user } = useAuth();
  const [creator, setCreator] = useState(null);
  const [tiers, setTiers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      creatorsAPI.getProfile(username),
      creatorsAPI.getTiers(username),
      postsAPI.byCreator(username),
    ]).then(([profileRes, tiersRes, postsRes]) => {
      setCreator(profileRes.data);
      setTiers(tiersRes.data);
      setPosts(postsRes.data);
    }).finally(() => setLoading(false));
  }, [username]);

  async function handleSubscribe(tierId) {
    try {
      const res = await subscriptionsAPI.checkout(tierId);
      window.location.href = res.data.url; // Redirect to Stripe Checkout
    } catch (err) {
      alert(err.response?.data?.error || 'Subscription failed');
    }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '3rem' }}>Loading...</div>;
  if (!creator) return <div style={{ textAlign: 'center', padding: '3rem' }}>Creator not found.</div>;

  const isOwner = user?.id === creator.id;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '1rem' }}>
      {/* Cover + Avatar */}
      <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #e5e7eb', marginBottom: '1.5rem' }}>
        <div style={{
          height: 200,
          background: creator.cover_image_url ? `url(${creator.cover_image_url}) center/cover` : 'linear-gradient(135deg, #4f46e5, #7c3aed)',
        }} />
        <div style={{ padding: '1rem', paddingTop: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem', marginTop: -40 }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: creator.avatar_url ? `url(${creator.avatar_url}) center/cover` : '#e0e7ff',
              border: '4px solid #fff', flexShrink: 0,
            }} />
            <div style={{ paddingBottom: '0.5rem' }}>
              <h1 style={{ margin: 0, fontSize: '1.5rem' }}>{creator.display_name}</h1>
              <div style={{ color: '#888' }}>@{creator.username} &middot; {creator.category}</div>
            </div>
            {isOwner && (
              <Link to="/dashboard" style={{ marginLeft: 'auto', background: '#f3f4f6', padding: '0.4rem 1rem', borderRadius: 6, textDecoration: 'none', color: '#374151', marginBottom: '0.5rem' }}>
                Edit Profile
              </Link>
            )}
          </div>
          {creator.tagline && <p style={{ color: '#374151', marginTop: '0.75rem' }}>{creator.tagline}</p>}
          <div style={{ color: '#888', fontSize: '0.85rem' }}>
            {creator.subscriber_count?.toLocaleString() || 0} subscribers
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.5rem' }}>
        {/* Posts */}
        <div>
          <h2 style={{ marginTop: 0 }}>Posts</h2>
          {posts.length === 0 && <p style={{ color: '#888' }}>No posts yet.</p>}
          {posts.map((post) => (
            <div key={post.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, marginBottom: '1rem', overflow: 'hidden' }}>
              {post.thumbnail_url && !post.locked && (
                <img src={post.thumbnail_url} alt="" style={{ width: '100%', maxHeight: 220, objectFit: 'cover' }} />
              )}
              <div style={{ padding: '1rem' }}>
                <Link to={`/post/${post.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <h3 style={{ margin: '0 0 0.5rem' }}>{post.title}</h3>
                </Link>
                {post.locked ? (
                  <div style={{ background: '#f9fafb', borderRadius: 8, padding: '1rem', textAlign: 'center', color: '#888' }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>&#128274;</div>
                    <div>Subscribe to unlock this post</div>
                  </div>
                ) : (
                  <p style={{ color: '#374151', margin: 0, fontSize: '0.9rem' }}>
                    {post.body?.slice(0, 200)}{post.body?.length > 200 ? '...' : ''}
                  </p>
                )}
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', color: '#888', fontSize: '0.8rem' }}>
                  <span>{post.view_count?.toLocaleString() || 0} views</span>
                  <span>{post.like_count?.toLocaleString() || 0} likes</span>
                  <span>{new Date(post.published_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Subscription tiers */}
        <div>
          <h2 style={{ marginTop: 0 }}>Subscribe</h2>
          {tiers.length === 0 && <p style={{ color: '#888' }}>No tiers available yet.</p>}
          {tiers.map((tier) => (
            <div key={tier.id} style={{ border: '1px solid #4f46e5', borderRadius: 10, padding: '1rem', marginBottom: '1rem', background: '#fafafe' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <strong>{tier.name}</strong>
                <span style={{ color: '#4f46e5', fontWeight: 700 }}>${(tier.price_cents / 100).toFixed(2)}/mo</span>
              </div>
              {tier.description && <p style={{ color: '#555', fontSize: '0.9rem', margin: '0 0 0.75rem' }}>{tier.description}</p>}
              {tier.benefits?.length > 0 && (
                <ul style={{ paddingLeft: '1.2rem', margin: '0 0 0.75rem', fontSize: '0.85rem', color: '#374151' }}>
                  {tier.benefits.map((b, i) => <li key={i}>{b}</li>)}
                </ul>
              )}
              {user ? (
                isOwner ? null : (
                  <button
                    onClick={() => handleSubscribe(tier.id)}
                    style={{ width: '100%', background: '#4f46e5', color: '#fff', border: 'none', padding: '0.6rem', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
                  >
                    Subscribe
                  </button>
                )
              ) : (
                <Link to="/login" style={{ display: 'block', textAlign: 'center', background: '#4f46e5', color: '#fff', padding: '0.6rem', borderRadius: 6, textDecoration: 'none', fontWeight: 600 }}>
                  Log in to Subscribe
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
