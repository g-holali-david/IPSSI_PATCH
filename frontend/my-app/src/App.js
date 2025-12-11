import { useEffect, useState } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [users, setUsers] = useState([]);
  const [queryId, setQueryId] = useState('');
  const [queriedUser, setQueriedUser] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    axios.get('http://localhost:8000/users')
      .then(res => setUsers(res.data))
      .catch(err => console.error(err.message));
    
    loadComments();
  }, []);

  const loadComments = async () => {
    try {
      const response = await axios.get('http://localhost:8000/comments');
      setComments(response.data);
    } catch (err) {
      console.error('Error loading comments:', err.message);
    }
  };

  const handleQuery = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://localhost:8000/user', `SELECT id, name FROM users WHERE id = ${queryId}`, 
        {
          headers : {
            "Content-Type" : 'text/plain'
          }
        }
      );
      setQueriedUser(response.data);
    } catch (err) {
      console.error('Error querying user:', err.message);
      setQueriedUser(null);
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:8000/comment', newComment, {
        headers: {
          "Content-Type": 'text/plain'
        }
      });
      setNewComment('');
      loadComments();
    } catch (err) {
      console.error('Error submitting comment:', err.message);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        
        <section style={{ marginBottom: '3rem', border: '2px solid #61dafb', padding: '1rem', borderRadius: '8px' }}>
          <h3>Users IDs in SQLite</h3>
          {users.map(u => <p key={u.id}>{u.id}</p>)}

          <form onSubmit={handleQuery} style={{ marginTop: '1rem' }}>
            <input
              type="text"
              placeholder="Enter user ID"
              value={queryId}
              onChange={(e) => setQueryId(e.target.value)}
              required
            />
            <button type="submit">Query User</button>
          </form>

          {queriedUser && queriedUser.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <h3>Queried User:</h3>
              {queriedUser.map(u => (
                <p key={u.id}>
                  ID: {u.id} — Name: {u.name} — Password: {u.password}
                </p>
              ))}
            </div>
          )}
        </section>

        <section style={{ border: '2px solid #ff6b6b', padding: '1rem', borderRadius: '8px' }}>
          
          <form onSubmit={handleCommentSubmit} style={{ marginTop: '1rem' }}>
            <textarea
              placeholder="Enter your comment"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              style={{ 
                width: '80%', 
                height: '80px', 
                marginBottom: '0.5rem',
                padding: '0.5rem',
                fontSize: '1rem'
              }}
              required
            />
            <br />
            <button type="submit">Post Comment</button>
          </form>

          <div style={{ marginTop: '2rem', textAlign: 'left', maxWidth: '80%', margin: '2rem auto' }}>
            <h3>Comments:</h3>
            {comments.length === 0 ? (
              <p>No comments yet. TYPE ONE NOW !</p>
            ) : (
              comments.map(comment => (
                <div 
                    key={comment.id} 
                    style={{ 
                      background: '#282c34', 
                      padding: '1rem', 
                      marginBottom: '1rem', 
                      borderRadius: '4px',
                      border: '1px solid #444'
                    }}
                  >
                    {comment.content}
                  </div>
              ))
            )}
          </div>
        </section>
      </header>
    </div>
  );
}

export default App;