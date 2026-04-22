import React, { useState, useEffect } from 'react';
import { TestCase } from '../../types';

interface Props {
  onSave: (tc: TestCase) => void;
  initial?: Partial<TestCase>;
}

const empty = (): TestCase => ({
  id: `tc-${Date.now()}`,
  number: '',
  name: '',
  description: '',
  steps: '',
  expectedResult: '',
  actualResult: '',
  status: 'pending',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  tags: [],
  baseUrl: '',
});

export function TestCaseForm({ onSave, initial }: Props) {
  const [tc, setTc] = useState<TestCase>({ ...empty(), ...initial });
  const [saved, setSaved] = useState(false);
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (initial) setTc((prev) => ({ ...prev, ...initial }));
  }, [initial]);

  const field = (key: keyof TestCase, label: string, multiline = false, placeholder = '') => (
    <div className="field">
      <label htmlFor={key}>{label}</label>
      {multiline ? (
        <textarea
          id={key}
          value={tc[key] as string}
          onChange={(e) => setTc({ ...tc, [key]: e.target.value })}
          placeholder={placeholder}
          rows={3}
        />
      ) : (
        <input
          id={key}
          type="text"
          value={tc[key] as string}
          onChange={(e) => setTc({ ...tc, [key]: e.target.value })}
          placeholder={placeholder}
        />
      )}
    </div>
  );

  const handleSave = () => {
    if (!tc.number.trim() || !tc.name.trim()) {
      alert('Test Case Number and Name are required.');
      return;
    }
    onSave({ ...tc, updatedAt: new Date().toISOString() });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => setTc(empty());

  const addTag = () => {
    if (tagInput.trim() && !tc.tags.includes(tagInput.trim())) {
      setTc({ ...tc, tags: [...tc.tags, tagInput.trim()] });
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => setTc({ ...tc, tags: tc.tags.filter((t) => t !== tag) });

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-icon">📋</span>
        <h2>Test Case Info</h2>
      </div>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="number">Test Case Number *</label>
          <input
            id="number"
            type="text"
            value={tc.number}
            onChange={(e) => setTc({ ...tc, number: e.target.value })}
            placeholder="TC-001"
          />
        </div>
        <div className="field">
          <label htmlFor="status">Status</label>
          <select
            id="status"
            value={tc.status}
            onChange={(e) => setTc({ ...tc, status: e.target.value as TestCase['status'] })}
          >
            <option value="pending">Pending</option>
            <option value="pass">Pass</option>
            <option value="fail">Fail</option>
            <option value="skipped">Skipped</option>
          </select>
        </div>
      </div>

      {field('name', 'Test Case Name *', false, 'Login with valid credentials')}
      {field('baseUrl', 'Base URL', false, 'https://example.com')}
      {field('description', 'Description', true, 'Verify that a registered user can login successfully...')}
      {field('steps', 'Steps', true, '1. Navigate to login page\n2. Enter valid credentials\n3. Click Login')}
      {field('expectedResult', 'Expected Result', true, 'User is redirected to the dashboard')}
      {field('actualResult', 'Actual Result', true, 'Fill this after execution...')}

      <div className="field">
        <label>Tags</label>
        <div className="tag-input-row">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTag()}
            placeholder="smoke, regression..."
          />
          <button className="btn btn-sm btn-secondary" onClick={addTag}>Add</button>
        </div>
        <div className="tags">
          {tc.tags.map((tag) => (
            <span key={tag} className="tag">
              {tag}
              <button onClick={() => removeTag(tag)}>×</button>
            </span>
          ))}
        </div>
      </div>

      <div className="form-actions">
        <button className="btn btn-secondary" onClick={handleReset}>Reset</button>
        <button className={`btn btn-primary ${saved ? 'btn-success' : ''}`} onClick={handleSave}>
          {saved ? '✓ Saved' : 'Save Test Case'}
        </button>
      </div>
    </div>
  );
}
