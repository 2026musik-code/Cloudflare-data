const data = `\n \n\n \n\n {"id":"gen-123","choices":[{"message":{"content":"Halo"}}]}\n\n{"id":"gen-123","choices":[{"message":{"content":"Halo2"}}]}`;
function parseData(data) {
  if (typeof data === 'string') {
    let clean = data.trim();
    clean = clean.replace(/^[\s\n]+/, '');
    
    try {
      return JSON.parse(clean);
    } catch (e) {
      let braceCount = 0;
      let startIndex = clean.indexOf('{');
      if (startIndex !== -1) {
          for (let i = startIndex; i < clean.length; i++) {
              if (clean[i] === '{') braceCount++;
              if (clean[i] === '}') braceCount--;
              if (braceCount === 0) {
                  try {
                      return JSON.parse(clean.substring(startIndex, i + 1));
                  } catch (err) {
                      break;
                  }
              }
          }
      }
      console.warn("Failed to parse AI response data", e);
    }
  }
  return data;
}
console.log(parseData(data));
