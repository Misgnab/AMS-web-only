import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, Plugin} from 'vite';

const viteHmrSilencerPlugin = (): Plugin => ({
  name: 'vite-hmr-silencer',
  transformIndexHtml: {
    order: 'pre',
    handler() {
      return [
        {
          tag: 'script',
          injectTo: 'head-prepend',
          children: `(function() {
  function isViteNoise(val) {
    if (!val) return false;
    if (typeof val === 'string') {
      return val.indexOf('[vite]') !== -1 ||
             val.indexOf('vite-hmr') !== -1 ||
             val.indexOf('@vite/client') !== -1 ||
             val.indexOf('WebSocket closed without opened') !== -1 ||
             (val.indexOf('WebSocket') !== -1 && val.indexOf('failed') !== -1);
    }
    if (typeof val === 'object') {
      if (val.message && isViteNoise(val.message)) return true;
      if (val.stack && (val.stack.indexOf('@vite/client') !== -1 || val.stack.indexOf('[vite]') !== -1)) return true;
      if (val.reason && isViteNoise(val.reason)) return true;
      if (val.target && (val.target instanceof WebSocket || (val.target.nodeName === 'SCRIPT' && (val.target.src || '').indexOf('@vite') !== -1))) return true;
    }
    return false;
  }

  function anyArgMatches(args) {
    if (!args || !args.length) return false;
    for (var i = 0; i < args.length; i++) {
      if (isViteNoise(args[i])) return true;
    }
    return false;
  }

  var origError = console.error;
  console.error = function() {
    if (anyArgMatches(arguments)) return;
    return origError.apply(console, arguments);
  };

  var origWarn = console.warn;
  console.warn = function() {
    if (anyArgMatches(arguments)) return;
    return origWarn.apply(console, arguments);
  };

  var origInfo = console.info;
  console.info = function() {
    if (anyArgMatches(arguments)) return;
    return origInfo.apply(console, arguments);
  };

  var origDebug = console.debug;
  console.debug = function() {
    if (anyArgMatches(arguments)) return;
    return origDebug.apply(console, arguments);
  };

  window.addEventListener('error', function(e) {
    if (isViteNoise(e) || (e && isViteNoise(e.error)) || (e && isViteNoise(e.message))) {
      e.preventDefault();
      e.stopImmediatePropagation && e.stopImmediatePropagation();
      e.stopPropagation();
    }
  }, true);

  window.addEventListener('unhandledrejection', function(e) {
    if (isViteNoise(e) || (e && isViteNoise(e.reason))) {
      e.preventDefault();
      e.stopImmediatePropagation && e.stopImmediatePropagation();
      e.stopPropagation();
    }
  }, true);

  if (typeof window !== 'undefined' && typeof window.WebSocket !== 'undefined') {
    var NativeWS = window.WebSocket;
    window.WebSocket = function(url, protocols) {
      var isViteWS = false;
      if (protocols === 'vite-hmr' || (Array.isArray(protocols) && protocols.indexOf('vite-hmr') !== -1)) {
        isViteWS = true;
      }
      if (typeof url === 'string' && (url.indexOf('token=') !== -1 || url.indexOf('vite') !== -1)) {
        isViteWS = true;
      }
      if (isViteWS) {
        var dummy = new EventTarget();
        dummy.readyState = 1;
        dummy.OPEN = 1;
        dummy.CONNECTING = 0;
        dummy.CLOSING = 2;
        dummy.CLOSED = 3;
        dummy.url = String(url);
        dummy.protocol = 'vite-hmr';
        dummy.extensions = '';
        dummy.bufferedAmount = 0;
        dummy.binaryType = 'blob';
        dummy.send = function() {};
        dummy.close = function() {
          dummy.readyState = 3;
        };
        setTimeout(function() {
          try {
            var ev = new Event('open');
            dummy.dispatchEvent(ev);
          } catch (_) {}
        }, 0);
        return dummy;
      }
      return new NativeWS(url, protocols);
    };
    window.WebSocket.prototype = NativeWS.prototype;
    window.WebSocket.CONNECTING = 0;
    window.WebSocket.OPEN = 1;
    window.WebSocket.CLOSING = 2;
    window.WebSocket.CLOSED = 3;
  }
})();`
        }
      ];
    }
  }
});

export default defineConfig(() => {
  return {
    plugins: [
      viteHmrSilencerPlugin(),
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('lucide-react')) {
                return 'vendor-lucide';
              }
              if (id.includes('react') || id.includes('react-dom')) {
                return 'vendor-react';
              }
              if (id.includes('html5-qrcode') || id.includes('qrcode.react')) {
                return 'vendor-qrcode';
              }
              if (id.includes('motion')) {
                return 'vendor-motion';
              }
              return 'vendor-deps';
            }
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
