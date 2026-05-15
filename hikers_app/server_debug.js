const express = require('express');
const app = express();
const PORT = process.env.PORT || 8082;

app.get('/health', (req, res) => {
    res.json({ 
        status: 'DEBUG_ACTIVE', 
        message: 'If you see this, Node.js is WORKING. The issue is either Database connection or Proxy port.',
        port_used: PORT
    });
});

app.get('/login', (req, res) => {
    res.send('Node.js is receiving Login requests correctly.');
});

app.listen(PORT, () => {
    console.log('Debug server listening on port ' + PORT);
});

module.exports = app;
