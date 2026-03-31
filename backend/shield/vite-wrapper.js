// S.H.I.E.L.D. Dashboard Wrapper
// Polyfills CustomEvent for Node 18 and handles pathing to root node_modules

if (typeof global !== 'undefined' && typeof CustomEvent === 'undefined') {
    global.CustomEvent = class CustomEvent extends Event {
        constructor(event, params) {
            super(event, params);
            this.detail = params ? params.detail : undefined;
        }
    };
}

// Point to the vite binary in the project root
import('../../node_modules/vite/bin/vite.js');
