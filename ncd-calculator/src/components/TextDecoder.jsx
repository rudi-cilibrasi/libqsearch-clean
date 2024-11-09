import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

// Simple Card Components
const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-lg border border-gray-200 shadow-sm ${className}`}>
    {children}
  </div>
);

const CardContent = ({ children, className = "" }) => (
  <div className={`p-6 ${className}`}>
    {children}
  </div>
);

// Alert Components
const Alert = ({ children, variant = "default" }) => (
  <div className={`p-4 rounded-lg border ${
    variant === "destructive" ? "border-red-500 bg-red-50 text-red-700" : "border-gray-200 bg-gray-50"
  }`}>
    {children}
  </div>
);

const AlertDescription = ({ children }) => (
  <div className="text-sm">{children}</div>
);

const TextDecoder = () => {
  // Common encoding patterns for different language families
  const detectEncoding = (buffer) => {
    // Check for UTF-8 BOM
    if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
      return 'utf-8';
    }
    // Check for UTF-16LE BOM
    if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
      return 'utf-16le';
    }
    // Check for UTF-16BE BOM
    if (buffer[0] === 0xFE && buffer[1] === 0xFF) {
      return 'utf-16be';
    }
    
    // Default to UTF-8 if no BOM is detected
    return 'utf-8';
  };

  const decodeText = (buffer, encoding) => {
    try {
      return new TextDecoder(encoding).decode(buffer);
    } catch (error) {
      console.error(`Error decoding with ${encoding}:`, error);
      // Fallback to UTF-8
      return new TextDecoder('utf-8').decode(buffer);
    }
  };

  return { detectEncoding, decodeText };
};

const TranslationViewer = ({ languageCode, url }) => {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { detectEncoding, decodeText } = TextDecoder();

  useEffect(() => {
    const fetchPDF = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const buffer = await response.arrayBuffer();
        const encoding = detectEncoding(new Uint8Array(buffer));
        const text = decodeText(buffer, encoding);
        
        setContent(text);
      } catch (err) {
        setError(`Failed to load translation: ${err.message}`);
        console.error('Error fetching PDF:', err);
      } finally {
        setLoading(false);
      }
    };

    if (url) {
      fetchPDF();
    }
  }, [url, languageCode]);

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading translation...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="w-full">
      <CardContent>
        <div className="whitespace-pre-wrap font-mono text-sm">
          {content || 'No content available'}
        </div>
      </CardContent>
    </Card>
  );
};

export const TranslationContainer = ({ LANGUAGE_URLS, LANGUAGE_NAMES }) => {
  const [selectedLanguage, setSelectedLanguage] = useState('eng');
  
  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      <div className="flex items-center space-x-2">
        <select 
          value={selectedLanguage}
          onChange={(e) => setSelectedLanguage(e.target.value)}
          className="p-2 border rounded bg-white"
        >
          {Object.entries(LANGUAGE_NAMES).map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
      </div>
      
      <TranslationViewer 
        languageCode={selectedLanguage}
        url={LANGUAGE_URLS[selectedLanguage]}
      />
    </div>
  );
};