(function () {
  'use strict';

  if (window.__ageBypassInstalled) return;
  window.__ageBypassInstalled = true;

  const VISIBILITY_TYPE = 'TweetWithVisibilityResults';
  const MARKERS = [
    VISIBILITY_TYPE,
    'media_visibility_results',
    'visibility_results',
    'blurred_image_interstitial',
    'AgeVerificationPrompt'
  ];

  const hasMarkers = (text) => MARKERS.some((m) => text.includes(m));

  function clean(obj) {
    if (!obj || typeof obj !== 'object') return;

    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        if (obj[i]?.__typename === VISIBILITY_TYPE && obj[i].tweet) {
          obj[i] = obj[i].tweet;
          obj[i].__typename = 'Tweet';
        }
        clean(obj[i]);
      }
      return;
    }

    delete obj.media_visibility_results;
    delete obj.visibility_results;
    delete obj.blurred_image_interstitial;

    for (const key in obj) {
      const val = obj[key];

      if (val?.__typename === VISIBILITY_TYPE && val.tweet) {
        obj[key] = val.tweet;
        obj[key].__typename = 'Tweet';
        clean(obj[key]);
      } else if (val && typeof val === 'object') {
        clean(val);
      }
    }
  }

  function getUrl(input) {
    try {
      if (typeof input === 'string') return input;
      if (input instanceof URL) return input.href;
      if (input && typeof input.url === 'string') return input.url;
      return String(input);
    } catch {
      return '';
    }
  }


  const originalFetch = window.fetch;

  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);

    if (!getUrl(args[0]).includes('/graphql/')) return response;

    try {
      const text = await response.clone().text();
      if (!hasMarkers(text)) return response;

      const data = JSON.parse(text);
      clean(data);
      return new Response(JSON.stringify(data), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
    } catch {
      return response;
    }
  };


  const originalParse = JSON.parse;

  JSON.parse = function (text, reviver) {
    const result = originalParse.call(this, text, reviver);
    try {
      if (typeof text === 'string' && text.length > 200 && hasMarkers(text)) {
        clean(result);
      }
    } catch {
    }
    return result;
  };
})();
