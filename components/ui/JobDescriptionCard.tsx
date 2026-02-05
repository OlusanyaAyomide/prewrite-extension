interface JobDescriptionCardProps {
  descriptions: string[];
}

export function JobDescriptionCard({ descriptions }: JobDescriptionCardProps) {
  if (descriptions.length === 0) {
    return null;
  }

  // Parse markdown-style bold text (**text**)
  function formatDescription(text: string) {
    // Convert **text** to <strong>text</strong>
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  }

  return (
    <div className="description-section">
      <div className="description-card">
        <p className="description-title">
          Job Requirements
          <span style={{ fontWeight: 'normal', opacity: 0.7 }}> ({descriptions.length})</span>
        </p>
        <div className="description-content">
          {descriptions.map((desc, index) => (
            <div key={index} style={{ marginBottom: index < descriptions.length - 1 ? '12px' : 0 }}>
              {formatDescription(desc)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
