const axios = require('axios');
(async () => {
  try {
    const res = await axios.get('https://api.vapi.ai/call/019fb34b-b92f-700b-92ad-30b9809c0c04/mono-recording', {
      headers: { Authorization: 'Bearer 332f370e-d80e-43ae-82bf-cb8a5984930b' },
      maxRedirects: 0,
      validateStatus: status => status >= 200 && status < 400
    });
    console.log("Location Header:", res.headers.location);
  } catch(e) {
    console.error(e.message);
  }
})();
