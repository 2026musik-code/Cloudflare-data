const axios = require('axios');
async function run() {
  try {
    const res = await axios.post('https://api.azkhavps.my.id/v1/chat/completions', {
      model: 'kc/kilo-auto/free',
      messages: [{role: 'user', content: 'test'}]
    }, {
      headers: {
        'Authorization': 'Bearer realmiajh67@gmail.com:cfk_12345'
      }
    });
    console.log(res.data);
  } catch (e) {
    console.error(e.response ? e.response.data : e.message);
  }
}
run();
