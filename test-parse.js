const data = `\n \n\n \n\n {"id":"gen-123","choices":[{"message":{"content":"Halo"}}]}\n\n`;
function parseData(data) {
  if (typeof data === 'string') {
    try {
      const start = data.indexOf('{');
      const end = data.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end >= start) {
        return JSON.parse(data.substring(start, end + 1));
      }
      return JSON.parse(data.trim());
    } catch (e) {
      console.warn("Failed to parse AI response data", e);
    }
  }
  return data;
}
console.log(parseData(data));
