import { useState, useEffect } from 'react';
import { moderationAPI } from '../services/api';

export default function ContentPolicy() {
  const [policy, setPolicy] = useState(null);

  useEffect(() => {
    moderationAPI.getPolicy().then((res) => setPolicy(res.data));
  }, []);

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '2rem 1rem' }}>
      <h1>Content Policy</h1>
      {policy ? (
        <>
          <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: '1rem', marginBottom: '2rem' }}>
            <strong>Our Commitment:</strong> {policy.summary}
          </div>

          <p style={{ color: '#555' }}>
            Version {policy.policy_version} &mdash; Last updated {policy.last_updated}
          </p>

          <h2>What Is NOT Allowed</h2>
          <p style={{ color: '#555' }}>
            We only take action on content that clearly violates one of these specific rules.
            We do <strong>not</strong> moderate based on viewpoint, political opinion, or topic.
          </p>

          {Object.entries(policy.rules).map(([key, description]) => (
            <div key={key} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
              <strong style={{ textTransform: 'capitalize', color: '#dc2626' }}>
                {key.replace(/-/g, ' ')}
              </strong>
              <p style={{ margin: '0.5rem 0 0', color: '#374151' }}>{description}</p>
            </div>
          ))}

          <h2>Appeals Process</h2>
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '1rem' }}>
            <p style={{ margin: 0 }}>{policy.appeals_process}</p>
            <p style={{ margin: '0.75rem 0 0', color: '#1d4ed8' }}>
              If you have received a moderation notice, you can submit an appeal from your account dashboard.
            </p>
          </div>
        </>
      ) : (
        <p>Loading policy...</p>
      )}
    </div>
  );
}
