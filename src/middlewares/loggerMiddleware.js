/**
 * Custom Request/Response Logger Middleware
 */
const loggerMiddleware = (req, res, next) => {
  const start = Date.now();
  const { method, url, body, query } = req;

  // Intercept response send to log the body
  const originalSend = res.send;
  res.send = function (data) {
    res.body = data;
    return originalSend.apply(res, arguments);
  };

  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;

    console.log(`\n--- [${new Date().toISOString()}] ---`);
    console.log(`${method} ${url} ${statusCode} (${duration}ms)`);
    
    if (Object.keys(query).length > 0) {
      console.log('Query:', JSON.stringify(query, null, 2));
    }

    if (body && Object.keys(body).length > 0) {
      // Don't log huge bodies (like base64 images) fully
      const logBody = { ...body };
      if (logBody.image_base64) logBody.image_base64 = `[Base64 Image: ${logBody.image_base64.length} chars]`;
      if (logBody.image) logBody.image = '[File Binary]';
      
      console.log('Request Body:', JSON.stringify(logBody, null, 2));
    }

    if (res.body) {
      try {
        const parsedResBody = JSON.parse(res.body);
        console.log('Response Body:', JSON.stringify(parsedResBody, null, 2));
      } catch (e) {
        // Not JSON or already parsed
        const truncatedRes = typeof res.body === 'string' && res.body.length > 500 
          ? res.body.substring(0, 500) + '...' 
          : res.body;
        console.log('Response Body:', truncatedRes);
      }
    }
    console.log('------------------------------------\n');
  });

  next();
};

module.exports = loggerMiddleware;
