import { useState, useEffect } from 'react';
import { apiClient } from './api/client';
import { isSuccess } from './types/envelope';
import './App.css';

function App() {
  const [message, setMessage] = useState<string>('');
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<string>('checking...');
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState<string>('');

  // Check health on mount
  useEffect(() => {
    checkHealth();
  }, []);

  // Fetch hello message on mount
  useEffect(() => {
    fetchHello();
    fetchMessages();
  }, []);

  const checkHealth = async () => {
    const response = await apiClient.checkHealth();
    if (isSuccess(response)) {
      setHealth(`✅ Healthy (v${response.data.version})`);
    } else {
      setHealth('❌ Unhealthy');
    }
  };

  const fetchHello = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.getHello();

      if (isSuccess(response)) {
        setMessage(response.data.message);
        setCount(response.data.count);
      } else {
        setError(response.error.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    const response = await apiClient.listMessages({ limit: 5 });
    if (isSuccess(response)) {
      setMessages(response.data.messages);
    }
  };

  const handleCreateMessage = async () => {
    if (!newMessage.trim()) return;

    const response = await apiClient.createMessage(newMessage);
    if (isSuccess(response)) {
      setNewMessage('');
      fetchMessages();
    } else {
      setError(response.error.message);
    }
  };

  const handleRefresh = () => {
    fetchHello();
    fetchMessages();
  };

  const handleSimulateAuth = () => {
    // Simulate setting a user ID
    const userId = `user-${Math.random().toString(36).substr(2, 9)}`;
    apiClient.setUserId(userId);
    alert(`Simulated authentication as: ${userId}`);
    fetchHello();
  };

  const handleCreateSession = async () => {
    const response = await apiClient.createSessionPayload();
    if (isSuccess(response)) {
      console.log('Session payload created:', response.data);
      alert(`Session created! ${response.data.message}`);
    } else {
      setError(response.error.message);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Build Dashboard Application</h1>
        <p>Create a new interactive dashboard for monitoring workflows</p>
        <div className="health-status">
          API Status: {health}
        </div>
      </header>

      <main>
        <section className="hello-section">
          <h2>Hello World Demo</h2>

          {loading ? (
            <div>Loading...</div>
          ) : error ? (
            <div className="error">Error: {error}</div>
          ) : (
            <div className="message-display">
              <p className="main-message">{message}</p>
              <p className="visit-count">Visit Count: {count}</p>
            </div>
          )}

          <div className="actions">
            <button onClick={handleRefresh}>🔄 Refresh</button>
            <button onClick={handleSimulateAuth}>👤 Simulate Auth</button>
            <button onClick={handleCreateSession}>🔑 Create Session</button>
          </div>
        </section>

        <section className="messages-section">
          <h2>Messages</h2>

          <div className="create-message">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Enter a message..."
              onKeyPress={(e) => e.key === 'Enter' && handleCreateMessage()}
            />
            <button onClick={handleCreateMessage}>Add Message</button>
          </div>

          <div className="messages-list">
            {messages.length === 0 ? (
              <p>No messages yet</p>
            ) : (
              <ul>
                {messages.map((msg) => (
                  <li key={msg.id}>
                    <span className="message-text">{msg.message}</span>
                    <span className="message-meta">
                      (Count: {msg.count}, {new Date(msg.createdAt).toLocaleDateString()})
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="info-section">
          <h2>Zyp Platform Compliance</h2>
          <ul>
            <li>✅ React 19.2.0 with Vite 6.0.11</li>
            <li>✅ TypeScript 5.4.5</li>
            <li>✅ Exact version pinning (no ^ or ~)</li>
            <li>✅ Envelope pattern for API responses</li>
            <li>✅ Trust x-user-id header (no JWT signing)</li>
            <li>✅ Communicates with Fastify 5.6.1 backend</li>
          </ul>
        </section>

        <p className="generated-by">
          Generated by <strong>Agentic SDLC</strong> with Zyp Compliance
        </p>
      </main>
    </div>
  );
}

export default App
