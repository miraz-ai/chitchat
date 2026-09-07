import React, { useState } from 'react';
import { Copy, Check, Code } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface CodeBlockProps {
  code: string;
  language?: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ code, language = 'typescript' }) => {
  const [copied, setCopied] = useState(false);
  const { playSound } = useTheme();

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    playSound('pop');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        margin: '8px 0',
        borderRadius: 'var(--radius-md)',
        background: '#0d1117',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        overflow: 'hidden',
        fontFamily: 'var(--font-mono)',
        fontSize: '13px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          background: 'rgba(255, 255, 255, 0.05)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
          <Code size={14} />
          <span style={{ textTransform: 'lowercase', fontSize: '12px' }}>{language}</span>
        </div>
        <button
          onClick={handleCopy}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: 'transparent',
            border: 'none',
            color: copied ? 'var(--accent-emerald)' : 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      <pre
        style={{
          padding: '12px',
          margin: 0,
          overflowX: 'auto',
          color: '#e6edf3',
          lineHeight: 1.5,
        }}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
};
