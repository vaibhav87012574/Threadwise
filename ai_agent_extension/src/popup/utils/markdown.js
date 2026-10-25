export const parseMarkdown = (text) => {
  let html = text;
  
  // Convert **bold** to <strong>
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Convert *italic* to <em>
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  // Convert [text](url) to links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  
  // Convert bullet points (*)
  html = html.replace(/^\* (.+)$/gm, '<li>$1</li>');
  
  // Wrap consecutive <li> tags in <ul>
  html = html.replace(/(<li>.*<\/li>)/gs, function(match) {
    const lines = match.split('\n').filter(line => line.trim());
    if (lines.length > 0) {
      return '<ul>' + lines.join('') + '</ul>';
    }
    return match;
  });
  
  // Convert line breaks to paragraphs
  const paragraphs = html.split('\n\n').filter(p => p.trim());
  html = paragraphs.map(p => {
    p = p.trim();
    // Don't wrap lists in paragraphs
    if (p.startsWith('<ul>') || p.startsWith('<ol>')) {
      return p;
    }
    return `<p>${p}</p>`;
  }).join('');
  
  return html;
};
