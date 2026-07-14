const axios = require('axios');
async function run() {
  try {
    const res = await axios.post('https://api.azkhavps.my.id/v1/chat/completions', {
      model: 'kc/kilo-auto/free',
      messages: [{role: 'user', content: 'Analyze this code: ' + 'A'.repeat(5000)}]
    }, {
      headers: {
        'Authorization': 'Bearer test'
      }
    });
    console.log(res.data);
  } catch (e) {
    if (e.response) {
       console.log('STATUS:', e.response.status);
       console.log('DATA:', e.response.data);
    } else {
       console.log(e.message);
    }
  }
}
run();
