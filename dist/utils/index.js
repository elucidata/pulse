import{c as i,d}from"../chunk-G46YZ25X.js";function u(n){let t=0,o=null,e=i(void 0);return{get value(){return e.value},peek(){return e.peek()},get(){return e.get()},map(r){return f(this,r)},filter(r){return p(this,r)},subscribe(r){t++,t===1&&(o=n(a=>{e.set(a)}));let l=e.subscribe(a=>{a!==void 0&&r(a)});return()=>{l(),t--,t===0&&o&&(o(),o=null,e.set(void 0))}}}}function O(n,t){return u(o=>{let e=r=>o(r);return n.addEventListener(t,e),()=>{n.removeEventListener(t,e)}})}function f(n,t){return u(o=>n.subscribe(r=>{o(t(r))}))}function p(n,t){return u(o=>n.subscribe(r=>{t(r)&&o(r)}))}var b={storage:globalThis.localStorage,toStorage:JSON.stringify,fromStorage:JSON.parse};function c(n,t,o){let{storage:e,toStorage:r,fromStorage:l}={...b,...o};if(!e)return console.warn("No storage available, using regular signal",n),i(t);let a=e.getItem(n),s=i(a?l(a):t);return d(()=>{let T=r(s.value),g=l(e.getItem(n));T!==g&&e.setItem(n,T)}),s}function v(n,t,o=!1){let e=n.peek(),r=typeof t=="function"?t(e):t;if(typeof r!="object"||r===null)return n.set(r);{let a={...e,...r};return n.set(a),o?m(e,a):void 0}}function m(n,t){let o=Reflect.ownKeys(n),e=Reflect.ownKeys(t),r=e.filter(s=>!o.includes(s)),l=o.filter(s=>!e.includes(s)),a=o.filter(s=>n[s]!==t[s]);return[...r,...l,...a]}export{p as filter,O as fromDomEvent,f as map,u as observable,c as persistedSignal,v as update};
